import { analyseFinishedWord } from './analysis';
import type { Round } from './game';
import type { WordData } from './wordLists';

self.onmessage = ({ data }: MessageEvent<{ round: Round; words: WordData }>) => {
  self.postMessage(analyseFinishedWord(data.round, data.words));
};
