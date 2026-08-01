import { extractSubgroupNumber, getMergeType } from './app/utils/subgroups.js';
console.log('--- Subgroup Number Extraction ---');
console.log('GL1.1', extractSubgroupNumber('GL1.1'));
console.log('G.L.1 (01)', extractSubgroupNumber('G.L.1 (01)'));
console.log('S,2', extractSubgroupNumber('S,2'));
console.log('MAGISTRAL (02)', extractSubgroupNumber('MAGISTRAL (02)'));
console.log('GA1.1', extractSubgroupNumber('GA1.1'));
console.log('M', extractSubgroupNumber('M'));
console.log('TA1', extractSubgroupNumber('TA1'));
console.log('GO,1', extractSubgroupNumber('GO,1'));
console.log('T01', extractSubgroupNumber('T01'));
console.log('0,483665', extractSubgroupNumber('0,483665'));

console.log('\n--- Merge Type ---');
console.log('MAGISTRAL (02)', getMergeType('MAGISTRAL (02)'));
console.log('GA1.1', getMergeType('GA1.1'));
console.log('GL1.1', getMergeType('GL1.1'));
