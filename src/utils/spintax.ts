/**
 * Spintax and Dynamic Variable Engine for Metus Auto-Post
 * Supports recursive {option1|option2|option3} syntax and [RANDOM *] tags.
 */

export function parseSpintax(text: string): string {
  if (!text) return '';

  const spintaxRegex = /\{([^{}]+)\}/g;
  let result = text;

  // Process innermost brackets first until no brackets remain
  while (spintaxRegex.test(result)) {
    result = result.replace(spintaxRegex, (_, options) => {
      const choices = options.split('|');
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex] ?? '';
    });
  }

  return result;
}

export function replaceVariables(text: string): string {
  if (!text) return '';

  const now = new Date();

  // [RANDOM T] -> Formatted Time (e.g., 14:45:12)
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const randomT = `${hours}:${minutes}:${seconds}`;

  // [RANDOM D] -> Formatted Date (e.g., 30 Okt 2026)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = String(now.getDate()).padStart(2, '0');
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const randomD = `${day} ${month} ${year}`;

  // [RANDOM M] -> Unique alphanumeric tracking hash/token
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomM = 'REF-';
  for (let i = 0; i < 5; i++) {
    randomM += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return text
    .replace(/\[RANDOM T\]/gi, randomT)
    .replace(/\[RANDOM D\]/gi, randomD)
    .replace(/\[RANDOM M\]/gi, randomM);
}

export function resolvePostContent(template: string): string {
  const withVars = replaceVariables(template);
  return parseSpintax(withVars);
}

/**
 * Generates N preview samples of the spintax template
 */
export function generateSpintaxSamples(template: string, count: number = 3): string[] {
  const samples: string[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(resolvePostContent(template));
  }
  return samples;
}

/**
 * Detects if the template contains spintax or variable tags
 */
export function hasDynamicElements(text: string): boolean {
  if (!text) return false;
  return /\{[^{}]+\}/.test(text) || /\[RANDOM [TDM]\]/i.test(text);
}
