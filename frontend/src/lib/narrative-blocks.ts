// The interpreter returns lightly formatted text: blank-line separated blocks,
// optionally opened by a bold or "#" heading line. Parsing it here keeps the
// display independent of CSS white-space handling and of raw "**" markers.
export interface NarrativeBlock {
  heading?: string;
  paragraphs: string[];
}

const BOLD_HEADING_RE = /^\*\*(.+?)\*\*[ \t]*(?:\n|$)/;
const HASH_HEADING_RE = /^#{1,6}[ \t]+(.+?)[ \t]*(?:\n|$)/;

const tidy = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const parseChunks = (narrative: string): NarrativeBlock[] =>
  narrative
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = chunk.match(BOLD_HEADING_RE) ?? chunk.match(HASH_HEADING_RE);
      if (!match) return { paragraphs: [tidy(chunk)] };
      const body = tidy(chunk.slice(match[0].length));
      return { heading: match[1].trim(), paragraphs: body ? [body] : [] };
    });

// A heading alone in its paragraph belongs to the text that follows it.
export const parseNarrative = (narrative: string): NarrativeBlock[] =>
  parseChunks(narrative).reduce<NarrativeBlock[]>((blocks, block) => {
    const prev = blocks[blocks.length - 1];
    if (prev?.heading && prev.paragraphs.length === 0 && !block.heading) {
      prev.paragraphs = block.paragraphs;
    } else {
      blocks.push(block);
    }
    return blocks;
  }, []);

/** Split a paragraph into plain and **bold** runs. */
export const splitBold = (text: string): { text: string; bold: boolean }[] =>
  text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false }
    );
