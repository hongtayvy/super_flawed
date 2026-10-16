// Sanity checks for the card data. Run with `npm run check-cards` after editing cards.ts.
import { FLAW_CARDS, POWER_CARDS } from '../src/cards';
import { config } from '../src/config';

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

const LICENSED = /\b(superman|batman|spider-?man|hulk|thor|iron ?man|wonder woman|aquaman|wolverine|captain america|deadpool|pikachu|goku|harry potter)\b/i;

const check = (label: string, cards: { id: string; text: string }[], maxLen: number, prefix?: string) => {
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const c of cards) {
    if (ids.has(c.id)) fail(`${label}: duplicate id ${c.id}`);
    ids.add(c.id);
    const key = c.text.toLowerCase().trim();
    if (texts.has(key)) fail(`${label}: duplicate text "${c.text}"`);
    texts.add(key);
    if (c.text.length > maxLen) fail(`${label} ${c.id}: ${c.text.length} chars, max ${maxLen}`);
    if (prefix && !c.text.startsWith(prefix)) fail(`${label} ${c.id}: should start with "${prefix}"`);
    if (!/[.!?"]$/.test(c.text)) fail(`${label} ${c.id}: missing end punctuation`);
    if (LICENSED.test(c.text)) fail(`${label} ${c.id}: mentions a licensed character`);
  }
};

check('power', POWER_CARDS, 70, 'You ');
check('flaw', FLAW_CARDS, 90, 'But ');

const needed = config.maxPlayers * config.handSize + 20;
if (FLAW_CARDS.length < needed) fail(`flaw deck has ${FLAW_CARDS.length} cards, needs at least ${needed}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`OK: ${POWER_CARDS.length} powers, ${FLAW_CARDS.length} flaws.`);
