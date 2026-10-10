// The interpreter returns lightly formatted text: blank-line separated blocks,
// optionally opened by a bold or "#" heading line. Parsing it here keeps the
// display independent of CSS white-space handling and of raw "**" markers.
export interface NarrativeBlock {
  heading?: string;
  paragraphs: string[];
}

const BOLD_HEADING_RE = /^\*\*(.+?)\*\*[ \t]*(?:\n|$)/;
const HASH_HEADING_RE = /^#{1,6}[ \t]+(.+?)[ \t]*(?:\n|$)/;
// Tolerance for a heading the model forgot to mark: the prompts ask for
// "**Card — Position**" on its own line, and the model sometimes drops the ** but
// keeps the shape. Accept only that shape: a short line containing " — ", no
// markers, no sentence punctuation at the end, with body text on the next line.
// Anything looser promotes hard-wrapped prose in any spread to a heading.
const PLAIN_HEADING_RE = /^([^\n*#]{1,80}?)[ \t]*\n(?=\S)/;
const TITLE_SHAPE_RE = /^[^.!?,;:"')\]…]*\S — \S[^.!?,;:"')\]…]*$/;

const matchHeading = (chunk: string): RegExpMatchArray | null => {
  const marked = chunk.match(BOLD_HEADING_RE) ?? chunk.match(HASH_HEADING_RE);
  if (marked) return marked;
  const plain = chunk.match(PLAIN_HEADING_RE);
  return plain && TITLE_SHAPE_RE.test(plain[1].trim()) ? plain : null;
};

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
      const match = matchHeading(chunk);
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
