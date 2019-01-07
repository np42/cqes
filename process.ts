import { Process } from './src/Process';

const process = new Process();
process.run();
(<any>global).CQES = process;
