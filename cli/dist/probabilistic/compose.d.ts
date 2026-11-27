import { type UniverseFS } from '../fs.js';
import type { CharacterMove, NarratorHandoffBundle, ObservableCharacterMove } from './schemas.js';
export interface WinningCharacterMove {
    character: string;
    characterId?: string;
    move: CharacterMove;
}
export interface ComposeNarratorOptions {
    book?: string;
    chapter?: number | string;
    asOf?: string;
    povCharacter: string;
    sceneSetup: string;
    winningMoves: WinningCharacterMove[];
    writingGuidePath?: string;
    projectRoot?: string;
    extraGuidance?: string[];
    ufs?: UniverseFS;
}
export declare const DEFAULT_NARRATOR_GUIDANCE: readonly string[];
/**
 * Strips non-observable fields (`notice`, `holdBack`, `tactic`) from a non-POV
 * character's winning move. Returns a fresh object containing strictly
 * `{ character, characterId?, say, physicalTell }`.
 */
export declare function stripToObservableSurface(entry: WinningCharacterMove): ObservableCharacterMove;
export declare function composeNarratorBundle(options: ComposeNarratorOptions): {
    bundle?: NarratorHandoffBundle;
    errors: string[];
};
export declare function renderNarratorBundleMarkdown(bundle: NarratorHandoffBundle): string;
