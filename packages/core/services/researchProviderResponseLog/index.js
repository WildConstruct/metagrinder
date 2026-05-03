const {
  MetagrinderProviderResponseLogSchema
} = require('../../types/metagrinder.runtime.js');

function buildEmptyProviderResponseLog({ inputId }) {
  return MetagrinderProviderResponseLogSchema.parse({
    inputId,
    responses: []
  });
}

module.exports = {
  buildEmptyProviderResponseLog
};
