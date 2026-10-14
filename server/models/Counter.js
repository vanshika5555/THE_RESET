const mongoose = require('mongoose');

// Running numbers that must never repeat or skip — e.g. invoice numbers.
const counterSchema = new mongoose.Schema({
  _id: { type: String },          // e.g. "invoice-2026-27"
  seq: { type: Number, default: 0 },
}, { versionKey: false });

counterSchema.statics.next = async function next(name) {
  const doc = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
