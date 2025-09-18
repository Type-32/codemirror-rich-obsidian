/**
 * This is a port of the code from the Alfaaz library. I DO NOT OWN THIS CODE. ALL CREDIT GOES TO THECODRR.
 * https://github.com/thecodrr/alfaaz
 */


import type { UnicodeRange } from '../../editor/types/editor-types'
import { BURMESE_UNICODE_RANGE } from './burmese'
import { CJK_UNICODE_RANGES } from './cjk'
import { JAVANESE_UNICODE_RANGE } from './javanese'
import { KHMER_UNICODE_RANGE } from './khmer'
import { LAO_UNICODE_RANGE } from './lao'
import { THAI_UNICODE_RANGE } from './thai'
import { VAI_UNICODE_RANGE } from './vai'

export const UNICODE_RANGES: UnicodeRange = [
	...THAI_UNICODE_RANGE,
	...LAO_UNICODE_RANGE,
	...BURMESE_UNICODE_RANGE,
	...KHMER_UNICODE_RANGE,
	...JAVANESE_UNICODE_RANGE,
	...VAI_UNICODE_RANGE,
	...CJK_UNICODE_RANGES,
]
