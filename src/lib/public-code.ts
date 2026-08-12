import { customAlphabet } from "nanoid";

/**
 * Codes are printed as a QR on a 35×25 mm sticker, so they stay short — every
 * extra character pushes the QR to a higher version (more modules in the same
 * physical space) and makes it harder for a phone to read off a thermal print.
 *
 * The alphabet drops the look-alike characters (0/O, 1/I/L) so the code below
 * the QR can also be read out over the phone or typed in by hand when a label
 * is scuffed. 12 chars over a 32-char alphabet is 60 bits — the code is the
 * only thing guarding the public tracking page, so it must never be derived
 * from the row id or anything else guessable.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const CARGO_ITEM_PUBLIC_CODE_LENGTH = 12;

export const newCargoItemPublicCode = customAlphabet(ALPHABET, CARGO_ITEM_PUBLIC_CODE_LENGTH);
