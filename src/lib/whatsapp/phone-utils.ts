/**
 * Sanitize phone number for Meta WhatsApp API.
 * Meta requires digits only — no + prefix, no spaces, no dashes.
 * e.g. "+370 63949836" → "37063949836"
 */
export function sanitizePhoneForMeta(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Normalize phone number by removing all non-digit characters.
 * Used for comparing phone numbers in different formats.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/**
 * Compare two phone numbers accounting for trunk prefix differences.
 * e.g. "370063949836" (with trunk 0) matches "37063949836" (without trunk 0)
 * by comparing the last 8 digits.
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const n1 = normalizePhone(phone1)
  const n2 = normalizePhone(phone2)
  if (n1 === n2) return true
  if (n1.length >= 8 && n2.length >= 8) {
    return n1.slice(-8) === n2.slice(-8)
  }
  return false
}

/**
 * Validate phone number is E.164-like format (7-15 digits starting with non-zero).
 * Accepts with or without + prefix.
 */
export function isValidE164(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone)
}

/**
 * Generate plausible phone number variants for retry when Meta's
 * sandbox rejects a number with error #131030 ("not in allowed list").
 *
 * Many countries use a "trunk prefix" 0 for domestic dialing that is
 * meant to be dropped in international format (e.g. Lithuanian
 * "+370 063 949 836" domestically → "+370 63 949 836" international).
 * But some sandboxes register the number with the trunk 0 included,
 * causing sends to the correct international format to fail.
 *
 * This helper yields up to 3 variants:
 *   1. The original sanitized number (first attempt)
 *   2. With a trunk 0 inserted after the country code
 *   3. With a trunk 0 removed after the country code
 *
 * Country-code lengths of 1, 2, and 3 digits are tried because we
 * don't know the user's country ahead of time.
 *
 * @param sanitized - digits-only phone number (from sanitizePhoneForMeta)
 * @returns deduplicated list of variants, original first
 */

/*ARREGLADO PARA ARGENTINA Y MEXICO, PARA EL RESTO DE LOS PAISES SOLO QUITA CEROS, NO LOS AGREGA*/
export function phoneVariants(sanitized: string): string[] {
  if (!sanitized) return [];
  const seen = new Set<string>();
  
  const push = (v: string) => {
    if (v && !seen.has(v)) seen.add(v);
  };

  // 1. Siempre intentar primero el número original que ingresó el usuario
  push(sanitized);

  // 2. Reglas específicas para ARGENTINA (54)
  if (sanitized.startsWith('54')) {
    const rest = sanitized.slice(2); // Todo lo que está después del 54
    
    // Quitamos el '9' inicial si lo tiene
    const sinNueve = rest.startsWith('9') ? rest.slice(1) : rest;
    
    // Quitamos el '0' inicial si lo tiene (el 0 del código de área)
    const sinNueveNiCero = sinNueve.startsWith('0') ? sinNueve.slice(1) : sinNueve;
    const conNueveSinCero = rest.startsWith('9') && rest.charAt(1) === '0'
        ? '9' + rest.slice(2) 
        : rest;

    // Variante A: (La que te funcionó a ti) -> Sin 9 y sin 0
    push('54' + sinNueveNiCero);
    
    // Variante B: Con 9 pero sin 0
    push('54' + conNueveSinCero);
  }

  // 3. Reglas específicas para MÉXICO (52)
  if (sanitized.startsWith('52')) {
    const rest = sanitized.slice(2);
    // En México el dígito extra problemático es el '1' después del 52
    if (rest.startsWith('1')) {
      push('52' + rest.slice(1)); // Sin el 1
    } else {
      push('521' + rest); // Con el 1
    }
  }

  // 4. Limpieza segura para el resto de países (Solo quitar ceros, NO inventarlos)
  // Revisa los primeros 1, 2 o 3 dígitos y si hay un 0 después, lo quita.
  for (const ccLen of [1, 2, 3]) {
    if (sanitized.length <= ccLen + 1) continue;
    const cc = sanitized.slice(0, ccLen);
    const rest = sanitized.slice(ccLen);
    if (rest.startsWith('0')) {
      push(cc + rest.slice(1));
    }
  }

  return [...seen];
}

/**
 * Returns true when the Meta API error indicates the recipient
 * phone number isn't in the allowed list (sandbox restriction).
 * Detected via error code 131030 or the standard error text.
 */
export function isRecipientNotAllowedError(message: string): boolean {
  return /131030|not in allowed list|not in the allowed list/i.test(message)
}
