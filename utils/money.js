const toCents = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
};

const fromCents = (cents) => {
    const num = Number(cents);
    if (!Number.isFinite(num)) return 0;
    return Number((num / 100).toFixed(2));
};

const mapMoneyFields = (row, fields) => {
    if (!row) return row;
    const out = { ...row };
    fields.forEach((field) => {
        if (out[field] !== undefined && out[field] !== null) {
            out[field] = fromCents(out[field]);
        }
    });
    return out;
};

module.exports = {
    toCents,
    fromCents,
    mapMoneyFields
};
