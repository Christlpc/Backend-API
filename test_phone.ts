import { normalizePhone } from './src/utils/phoneUtils';

const phone1 = "066123456";
const phone2 = "+242 06 612 34 56";

console.log(`Original 1: ${phone1} -> Normalized: ${normalizePhone(phone1)}`);
console.log(`Original 2: ${phone2} -> Normalized: ${normalizePhone(phone2)}`);

if (normalizePhone(phone1) === normalizePhone(phone2)) {
    console.log("MATCH: Normalization works correctly.");
} else {
    console.log("MISMATCH: Normalization failed.");
}
