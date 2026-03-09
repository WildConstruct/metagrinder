function insertLineBreaksAroundStructuralMarkers(rawText) {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/([a-z0-9.)])([IVXLC]+\.\s+[A-Z])/g, '$1\n\n$2')
    .replace(/([a-z0-9.)])([A-Z]\.\s+(?:The|Archetype|Build|Facial|Distinguishing|Hair|Overall|Core|Outerwear|Footwear|Signature|Primary|Posture|Movement|Common|Voice|Combat|Technical|Survival|Defining|Characteristic|Assembly|Template))/g, '$1\n\n$2')
    .replace(/([IVXLC]+\.\s+[A-Z][A-Za-z0-9 &:/'(),-]{5,120}?)(?=(?:This|To |What |How |While|Because|A character|The following|Synthesizing|By |Ultimately|Furthermore))/g, '$1\n')
    .replace(/([A-Z]\.\s+The\s+[A-Z][A-Za-z0-9/&'(), -]{5,100}?)(?=(?:This|Often|Operating|Leans|Voice|A single|Stares))/g, '$1\n')
    .replace(/([a-z0-9.)])((?:Description|Template Example)\s+\d+\s*:)/g, '$1\n$2')
    .replace(/([a-z0-9.)])((?:IF|THEN|Contradiction Avoidance|Probability Weighting Suggestions)\b)/g, '$1\n$2')
    .replace(/([a-z0-9.)])(Table\s+\d+\s*:)/g, '$1\n\n$2')
    .replace(/([a-z0-9.)])([A-Z][A-Za-z/& -]{3,80}:\s*(?:This|The|A|An))/g, '$1\n\n$2');
}

function normalizeFlattenedLists(rawText) {
  return rawText
    .replace(/(Description\s+\d+\s*:[^\n]+?)\s+\((Focus:[^)]+)\)/g, '$1\n- $2')
    .replace(/(IF [^\n]+?)( THEN )/g, '$1\n$2')
    .replace(/(Higher Probability:)/g, '\n$1')
    .replace(/(Lower Probability \(but possible for contrast\/subversion\):)/g, '\n$1');
}

function preparseResearchBrief(rawText) {
  const normalizedText = normalizeFlattenedLists(
    insertLineBreaksAroundStructuralMarkers(rawText)
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const diagnostics = [];
  if (/([a-z0-9.])([IVXLC]+\.\s+[A-Z])/.test(rawText)) {
    diagnostics.push('restored-inline-roman-headings');
  }
  if (/Description\s+1:/.test(rawText)) {
    diagnostics.push('split-description-runs');
  }
  if (/Table\s+\d+\s*:/.test(rawText)) {
    diagnostics.push('restored-table-boundaries');
  }
  if (/IF [^.\n]+ THEN /.test(rawText) || /IF [^\n]+THEN /.test(rawText)) {
    diagnostics.push('split-conditional-logic');
  }

  return {
    normalizedText,
    diagnostics
  };
}

const api = {
  insertLineBreaksAroundStructuralMarkers,
  normalizeFlattenedLists,
  preparseResearchBrief
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

if (typeof window !== 'undefined') {
  window.MetagrinderResearchBriefPreparser = api;
}
