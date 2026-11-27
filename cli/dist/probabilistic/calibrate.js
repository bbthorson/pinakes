/**
 * Calibration harness (`pinakes calibrate`).
 *
 * Evaluates one or more DecisionScorers (e.g. `clef-flash` vs `clef` 27B)
 * against a JSONL dataset of labeled beats from an earlier book (e.g. 50–100
 * real beats: in-character vs OOC, fair-play vs over-signaled, true tell vs
 * false alarm) and reports accuracy, Brier score, Expected Calibration Error
 * (ECE), per-category breakdown, and cross-scorer agreement.
 */
import fs from 'fs';
import { z } from 'zod';
export const CalibrationExampleSchema = z.object({
    id: z.string().min(1),
    category: z.string().min(1),
    context: z.string().min(1),
    question: z.object({
        type: z.enum(['binary', 'enum', 'scale', 'move-choice']),
        prompt: z.string().min(1),
        options: z.array(z.string()).optional(),
        scale: z.tuple([z.number(), z.number()]).optional(),
    }),
    expectedLabel: z.string().min(1),
    metadata: z.record(z.unknown()).optional(),
});
export function parseCalibrationJsonl(content) {
    const examples = [];
    const errors = [];
    const lines = content.split(/\r?\n/);
    lines.forEach((raw, idx) => {
        const trimmed = raw.trim();
        if (!trimmed)
            return;
        try {
            const parsed = JSON.parse(trimmed);
            const res = CalibrationExampleSchema.safeParse(parsed);
            if (!res.success) {
                errors.push(`Line ${idx + 1}: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
            }
            else {
                examples.push(res.data);
            }
        }
        catch (e) {
            errors.push(`Line ${idx + 1}: invalid JSON (${e.message})`);
        }
    });
    return { examples, errors };
}
export function loadCalibrationJsonl(filePath) {
    if (!fs.existsSync(filePath)) {
        return { examples: [], errors: [`Calibration dataset not found: ${filePath}`] };
    }
    return parseCalibrationJsonl(fs.readFileSync(filePath, 'utf-8'));
}
function computeCalibrationMetrics(scorerName, examples, answers) {
    const predictions = [];
    const byCategoryAcc = {};
    let brierTotal = 0;
    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        const ans = answers[i];
        const probs = ans?.probabilities ?? {};
        const predictedLabel = ans?.topLabel ?? '';
        const topProb = ans?.topProbability ?? 0;
        const expectedProb = probs[ex.expectedLabel] ?? 0;
        const correct = predictedLabel.toLowerCase() === ex.expectedLabel.toLowerCase();
        // Multi-class Brier score: sum_k (p_k - y_k)^2
        const keys = new Set([...Object.keys(probs), ex.expectedLabel]);
        let brier = 0;
        for (const k of keys) {
            const p = probs[k] ?? 0;
            const y = k.toLowerCase() === ex.expectedLabel.toLowerCase() ? 1 : 0;
            brier += (p - y) * (p - y);
        }
        brierTotal += brier;
        const cat = byCategoryAcc[ex.category] ?? { total: 0, correct: 0, brierSum: 0 };
        cat.total++;
        if (correct)
            cat.correct++;
        cat.brierSum += brier;
        byCategoryAcc[ex.category] = cat;
        predictions.push({
            id: ex.id,
            category: ex.category,
            expectedLabel: ex.expectedLabel,
            predictedLabel,
            expectedProb,
            topProb,
            correct,
        });
    }
    // 5 reliability bins: [0, 0.2), [0.2, 0.4), [0.4, 0.6), [0.6, 0.8), [0.8, 1.0]
    const binCount = 5;
    const buckets = [];
    let ece = 0;
    for (let b = 0; b < binCount; b++) {
        const lo = b / binCount;
        const hi = (b + 1) / binCount;
        const items = predictions.filter((p) => b === binCount - 1 ? p.topProb >= lo && p.topProb <= hi : p.topProb >= lo && p.topProb < hi);
        if (items.length === 0)
            continue;
        const avgConf = items.reduce((s, p) => s + p.topProb, 0) / items.length;
        const empAcc = items.filter((p) => p.correct).length / items.length;
        const gap = Math.abs(avgConf - empAcc);
        ece += (items.length / Math.max(1, predictions.length)) * gap;
        buckets.push({
            range: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
            count: items.length,
            avgConfidence: avgConf,
            empiricalAccuracy: empAcc,
            gap,
        });
    }
    const total = predictions.length;
    const correct = predictions.filter((p) => p.correct).length;
    const byCategory = {};
    for (const [cat, acc] of Object.entries(byCategoryAcc)) {
        byCategory[cat] = {
            total: acc.total,
            correct: acc.correct,
            accuracy: acc.total ? acc.correct / acc.total : 0,
            brierScore: acc.total ? acc.brierSum / acc.total : 0,
        };
    }
    return {
        scorer: scorerName,
        total,
        correct,
        accuracy: total ? correct / total : 0,
        brierScore: total ? brierTotal / total : 0,
        ece,
        buckets,
        byCategory,
        predictions,
    };
}
export async function runCalibration(examples, scorers) {
    const scorerReports = [];
    for (const scorer of scorers) {
        const answers = [];
        for (const ex of examples) {
            const q = {
                id: ex.id,
                type: ex.question.type,
                prompt: ex.question.prompt,
                options: ex.question.options,
                scale: ex.question.scale,
            };
            const [ans] = await scorer.score({ context: ex.context, questions: [q] });
            answers.push(ans);
        }
        scorerReports.push(computeCalibrationMetrics(scorer.name, examples, answers));
    }
    const pairwiseAgreement = [];
    for (let i = 0; i < scorerReports.length; i++) {
        for (let j = i + 1; j < scorerReports.length; j++) {
            const a = scorerReports[i];
            const b = scorerReports[j];
            const n = Math.min(a.predictions.length, b.predictions.length);
            let agree = 0;
            for (let k = 0; k < n; k++) {
                if (a.predictions[k].predictedLabel.toLowerCase() === b.predictions[k].predictedLabel.toLowerCase()) {
                    agree++;
                }
            }
            pairwiseAgreement.push({
                scorerA: a.scorer,
                scorerB: b.scorer,
                agreementRate: n ? agree / n : 0,
                total: n,
            });
        }
    }
    return {
        datasetSize: examples.length,
        scorers: scorerReports,
        pairwiseAgreement,
    };
}
export function renderCalibrationMarkdown(report) {
    const out = [
        '# Pinakes Calibration Report',
        '',
        `Dataset size: **${report.datasetSize}** labeled examples.`,
        '',
        '| Scorer | Accuracy | Brier Score | ECE |',
        '| --- | ---: | ---: | ---: |',
    ];
    for (const s of report.scorers) {
        out.push(`| \`${s.scorer}\` | ${(s.accuracy * 100).toFixed(1)}% (${s.correct}/${s.total}) | ${s.brierScore.toFixed(4)} | ${s.ece.toFixed(4)} |`);
    }
    out.push('');
    if (report.pairwiseAgreement.length > 0) {
        out.push('## Cross-Scorer Agreement', '');
        for (const p of report.pairwiseAgreement) {
            out.push(`- \`${p.scorerA}\` vs \`${p.scorerB}\`: **${(p.agreementRate * 100).toFixed(1)}%** (${p.total} examples)`);
        }
        out.push('');
    }
    for (const s of report.scorers) {
        out.push(`## \`${s.scorer}\` — By Category`, '');
        out.push('| Category | Accuracy | Brier Score |');
        out.push('| --- | ---: | ---: |');
        for (const [cat, m] of Object.entries(s.byCategory)) {
            out.push(`| ${cat} | ${(m.accuracy * 100).toFixed(1)}% (${m.correct}/${m.total}) | ${m.brierScore.toFixed(4)} |`);
        }
        out.push('');
    }
    return out.join('\n');
}
