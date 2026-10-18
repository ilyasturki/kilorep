// Search names that say which grip, by the axis value they pick. Every phrase is also an alias
// of its exercise: search finds the entry, and this says how it is held.
export const GRIP_ALIASES: Record<string, Record<string, string>> = {
	'bench-press': {
		cgbp: 'close',
		'close grip bench': 'close',
		'narrow grip bench press': 'close',
		'cg bench press': 'close'
	},
	'pull-up': {
		'overhand pull up': 'overhand',
		'pronated pull up': 'overhand',
		chinup: 'underhand',
		'chin up': 'underhand',
		'supinated pull up': 'underhand',
		'underhand pull up': 'underhand',
		'reverse grip pull up': 'underhand',
		'neutral grip pull up': 'neutral',
		'hammer grip pull up': 'neutral'
	},
	'lat-pulldown': {
		'wide grip pulldown': 'wide',
		'wide pulldown': 'wide',
		'wide grip pull down': 'wide',
		'pronated pulldown': 'wide',
		'close grip pulldown': 'neutral',
		'narrow grip pulldown': 'neutral',
		'neutral grip pulldown': 'neutral',
		'v bar pulldown': 'neutral',
		'reverse grip pulldown': 'underhand',
		'underhand pulldown': 'underhand',
		'supinated pulldown': 'underhand'
	},
	'straight-arm-pulldown': {
		'rope straight arm pulldown': 'rope'
	},
	'seated-cable-row': {
		'v bar row': 'v-bar',
		'straight bar row': 'wide',
		'wide grip cable row': 'wide',
		'rope cable row': 'rope'
	},
	'cable-curl': {
		'rope curl': 'rope',
		'rope hammer curl': 'rope',
		'cable hammer curl': 'rope',
		'ez bar cable curl': 'ez'
	},
	'triceps-pushdown': {
		'rope pushdown': 'rope',
		'rope pressdown': 'rope',
		'bar pushdown': 'bar',
		'v bar pushdown': 'v-bar'
	},
	'overhead-triceps-extension': {
		'rope overhead extension': 'rope'
	},
	dip: {
		'chest dip': 'forward',
		'tricep dip': 'upright'
	}
};
