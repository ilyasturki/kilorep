import type { Exercise } from '$lib/domain/exercise';

export const catalog: Exercise[] = [
	{
		id: 'bench-press',
		name: 'Bench Press',
		aliases: [
			'bp',
			'flat bench',
			'flat bench press',
			'barbell bench press',
			'cgbp',
			'close grip bench',
			'narrow grip bench press',
			'cg bench press'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		pattern: 'horizontal-press',
		grips: {
			label: 'Grip',
			default: 'standard',
			values: [
				{ id: 'standard', label: 'Standard' },
				{
					id: 'close',
					label: 'Close',
					muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] }
				}
			]
		}
	},
	{
		id: 'incline-bench-press',
		name: 'Incline Bench Press',
		aliases: [
			'incline barbell press',
			'incline barbell bench press',
			'incline press',
			'incline bench'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'decline-bench-press',
		name: 'Decline Bench Press',
		aliases: ['decline barbell bench press', 'decline bench', 'decline press'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'dumbbell-bench-press',
		name: 'Dumbbell Bench Press',
		aliases: [
			'db bench',
			'dumbbell press',
			'db bench press',
			'db press',
			'flat dumbbell press',
			'dumbbell chest press'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'incline-dumbbell-press',
		name: 'Incline DB Press',
		aliases: ['incline dumbbell press', 'incline dumbbell bench press', 'incline db bench press'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'machine-chest-press',
		name: 'Machine Chest Press',
		aliases: [
			'chest press',
			'chest press machine',
			'seated chest press',
			'hammer strength chest press'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'incline-machine-chest-press',
		name: 'Incline Machine Press',
		aliases: [
			'incline machine chest press',
			'incline chest press machine',
			'seated incline chest press'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'smith-machine-bench-press',
		name: 'Smith Machine Bench Press',
		aliases: ['smith bench', 'smith bench press', 'smith press'],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'machine-bench-press',
		name: 'Machine Bench Press',
		aliases: [
			'lying machine bench press',
			'lying machine press',
			'lying chest press',
			'supine chest press',
			'plate loaded bench press',
			'hammer strength bench press',
			'bench press machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'incline-smith-machine-press',
		name: 'Incline Smith Press',
		aliases: [
			'incline smith machine press',
			'incline smith bench press',
			'incline smith bench',
			'smith incline press'
		],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: ['Shoulders', 'Triceps'] },
		pattern: 'horizontal-press',
		variantOf: 'bench-press'
	},
	{
		id: 'cable-fly',
		name: 'Cable Fly',
		aliases: ['cable crossover', 'crossover', 'cable chest fly', 'standing cable fly'],
		equipment: 'Cable',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: [] },
		pattern: 'fly',
		variantOf: 'dumbbell-fly'
	},
	{
		id: 'dumbbell-fly',
		name: 'Dumbbell Fly',
		aliases: ['db fly', 'chest fly', 'flyes', 'db flyes', 'dumbbell flyes', 'flat dumbbell fly'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: [] },
		pattern: 'fly'
	},
	{
		id: 'incline-dumbbell-fly',
		name: 'Incline DB Fly',
		aliases: ['incline dumbbell fly', 'incline fly', 'incline flyes'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Chest', secondary: ['Shoulders'] },
		pattern: 'fly',
		variantOf: 'dumbbell-fly'
	},
	{
		id: 'pec-deck',
		name: 'Pec Deck',
		aliases: ['butterfly', 'chest fly machine', 'machine fly', 'butterfly machine', 'pec fly'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: [] },
		pattern: 'fly',
		variantOf: 'dumbbell-fly'
	},
	{
		id: 'push-up',
		name: 'Push-Up',
		aliases: ['pushup', 'press up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.65,
		muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders', 'Core'] },
		pattern: 'horizontal-press'
	},

	{
		id: 'deadlift',
		name: 'Deadlift',
		aliases: ['dl', 'conventional deadlift', 'barbell deadlift', 'deads'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings', 'Forearms', 'Core'] },
		pattern: 'hinge'
	},
	{
		id: 'sumo-deadlift',
		name: 'Sumo Deadlift',
		aliases: ['sumo', 'sumo dl', 'wide stance deadlift'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings', 'Back', 'Quads'] },
		pattern: 'hinge',
		variantOf: 'deadlift'
	},
	{
		id: 'trap-bar-deadlift',
		name: 'Trap Bar Deadlift',
		aliases: ['hex bar deadlift', 'trap bar dl', 'hex bar dl', 'trap bar lift'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Quads', 'Hamstrings', 'Back', 'Forearms'] },
		pattern: 'hinge',
		variantOf: 'deadlift'
	},
	{
		id: 'rack-pull',
		name: 'Rack Pull',
		aliases: ['block pull', 'rack deadlift', 'partial deadlift', 'rack pulls'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings', 'Forearms'] },
		pattern: 'hinge',
		variantOf: 'deadlift'
	},
	{
		id: 'deficit-deadlift',
		name: 'Deficit Deadlift',
		aliases: ['deficit dl', 'deficit pull'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings', 'Quads', 'Forearms'] },
		pattern: 'hinge',
		variantOf: 'deadlift'
	},
	{
		id: 'snatch-grip-deadlift',
		name: 'Snatch-Grip Deadlift',
		aliases: ['snatch grip dl', 'wide grip deadlift'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings', 'Forearms'] },
		pattern: 'hinge',
		variantOf: 'deadlift'
	},
	{
		id: 'pull-up',
		name: 'Pull-Up',
		aliases: [
			'pullup',
			'overhand pull up',
			'pronated pull up',
			'wide grip pull up',
			'chinup',
			'chin up',
			'supinated pull up',
			'underhand pull up',
			'reverse grip pull up',
			'neutral grip pull up',
			'hammer grip pull up'
		],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'vertical-pull',
		grips: {
			label: 'Grip',
			default: 'overhand',
			values: [
				{ id: 'overhand', label: 'Pronated' },
				{
					id: 'underhand',
					label: 'Supinated',
					muscles: { primary: 'Back', secondary: ['Biceps'] }
				},
				{ id: 'neutral', label: 'Neutral' }
			]
		}
	},
	{
		id: 'lat-pulldown',
		name: 'Lat Pulldown',
		aliases: [
			'pulldown',
			'lat pull down',
			'front pulldown',
			'cable pulldown',
			'wide grip pulldown',
			'wide pulldown',
			'wide grip pull down',
			'pronated pulldown',
			'close grip pulldown',
			'narrow grip pulldown',
			'neutral grip pulldown',
			'v bar pulldown',
			'reverse grip pulldown',
			'underhand pulldown',
			'supinated pulldown'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		pattern: 'vertical-pull',
		grips: {
			label: 'Grip',
			default: 'wide',
			values: [
				{ id: 'wide', label: 'Pronated' },
				{ id: 'neutral', label: 'Neutral' },
				{ id: 'underhand', label: 'Supinated' }
			],
			retired: { close: 'neutral' }
		}
	},
	{
		id: 'single-arm-lat-pulldown',
		name: 'Single-Arm Pulldown',
		aliases: [
			'single arm lat pulldown',
			'one arm lat pulldown',
			'one arm pulldown',
			'unilateral lat pulldown'
		],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		pattern: 'vertical-pull',
		variantOf: 'lat-pulldown'
	},
	{
		id: 'machine-pulldown',
		name: 'Machine Pulldown',
		aliases: [
			'plate loaded pulldown',
			'hammer strength pulldown',
			'iso lateral pulldown',
			'pulldown machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		pattern: 'vertical-pull',
		variantOf: 'lat-pulldown'
	},
	{
		id: 'straight-arm-pulldown',
		name: 'Straight-Arm Pulldown',
		aliases: [
			'straight arm lat pulldown',
			'lat pushdown',
			'lat prayer',
			'cable pullover',
			'straight arm pushdown',
			'rope straight arm pulldown'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Triceps', 'Core'] },
		pattern: 'pullover',
		grips: {
			label: 'Attachment',
			default: 'bar',
			values: [
				{ id: 'bar', label: 'Straight Bar' },
				{ id: 'rope', label: 'Rope' }
			]
		}
	},
	{
		id: 'dumbbell-pullover',
		name: 'Dumbbell Pullover',
		aliases: ['db pullover', 'pullover', 'lying pullover', 'bench pullover'],
		equipment: 'Dumbbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Chest', 'Triceps'] },
		pattern: 'pullover'
	},
	{
		id: 'barbell-row',
		name: 'Barbell Row',
		aliases: ['bent over row', 'bor', 'bb row', 'bent row', 'bent over barbell row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull'
	},
	{
		id: 'seal-row',
		name: 'Seal Row',
		aliases: ['bench row', 'prone barbell row', 'barbell seal row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Shoulders'] },
		pattern: 'horizontal-pull',
		variantOf: 'barbell-row'
	},
	{
		id: 'seated-cable-row',
		name: 'Seated Cable Row',
		aliases: [
			'cable row',
			'seated row',
			'v bar row',
			'straight bar row',
			'wide grip cable row',
			'rope cable row'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		pattern: 'horizontal-pull',
		grips: {
			label: 'Handle',
			default: 'v-bar',
			values: [
				{ id: 'v-bar', label: 'V-Bar' },
				{ id: 'wide', label: 'Wide Bar' },
				{ id: 'rope', label: 'Rope' }
			],
			retired: { straight: 'wide' }
		}
	},
	{
		id: 'single-arm-cable-row',
		name: 'Single-Arm Cable Row',
		aliases: [
			'one arm cable row',
			'single arm seated row',
			'one arm seated cable row',
			'unilateral cable row'
		],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Back', secondary: ['Biceps'] },
		pattern: 'horizontal-pull',
		variantOf: 'seated-cable-row'
	},
	{
		id: 'dumbbell-row',
		name: 'Dumbbell Row',
		aliases: [
			'one arm row',
			'db row',
			'single arm row',
			'one arm dumbbell row',
			'db one arm row',
			'kroc row'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull'
	},
	{
		id: 'chest-supported-row',
		name: 'Chest-Supported Row',
		aliases: [
			'incline bench row',
			'incline dumbbell row',
			'incline db row',
			'chest supported dumbbell row',
			'prone incline row'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull',
		variantOf: 'dumbbell-row'
	},
	{
		id: 'inverted-row',
		name: 'Inverted Row',
		aliases: [
			'australian pull up',
			'body row',
			'bodyweight row',
			'ring row',
			'trx row',
			'smith machine inverted row'
		],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.6,
		muscles: { primary: 'Back', secondary: ['Biceps', 'Shoulders'] },
		pattern: 'horizontal-pull'
	},
	{
		id: 'pendlay-row',
		name: 'Pendlay Row',
		aliases: ['pendlay', 'dead stop row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull',
		variantOf: 'barbell-row'
	},
	{
		id: 't-bar-row',
		name: 'T-Bar Row',
		aliases: ['tbar row', 'landmine row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull'
	},
	{
		id: 'chest-supported-t-bar-row',
		name: 'Chest-Supported T-Bar Row',
		aliases: [
			'chest supported t bar',
			'incline t bar row',
			'machine t bar row',
			't bar row machine',
			'lying t bar row'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull',
		variantOf: 't-bar-row'
	},
	{
		id: 'meadows-row',
		name: 'Meadows Row',
		aliases: ['meadow row', 'one arm landmine row', 'single arm landmine row'],
		equipment: 'Barbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull',
		variantOf: 't-bar-row'
	},
	{
		id: 'machine-row',
		name: 'Machine Row',
		aliases: ['seated machine row', 'hammer row', 'hammer strength row', 'plate loaded row'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull'
	},
	{
		id: 'high-row',
		name: 'High Row',
		aliases: ['machine high row', 'hammer high row', 'plate loaded high row', 'high row machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull',
		variantOf: 'machine-row'
	},
	{
		id: 'low-row',
		name: 'Low Row',
		aliases: ['machine low row', 'hammer low row', 'plate loaded low row', 'low row machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Biceps', 'Forearms'] },
		pattern: 'horizontal-pull',
		variantOf: 'machine-row'
	},
	{
		id: 'barbell-shrug',
		name: 'Barbell Shrug',
		aliases: ['shrug', 'shrugs', 'trap shrug', 'bb shrug'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Forearms'] },
		pattern: 'shrug'
	},
	{
		id: 'dumbbell-shrug',
		name: 'Dumbbell Shrug',
		aliases: ['db shrug', 'dumbbell shrugs', 'db shrugs', 'db trap shrug'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Back', secondary: ['Forearms'] },
		pattern: 'shrug',
		variantOf: 'barbell-shrug'
	},
	{
		id: 'smith-machine-shrug',
		name: 'Smith Machine Shrug',
		aliases: ['smith shrug', 'smith machine shrugs'],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Forearms'] },
		pattern: 'shrug',
		variantOf: 'barbell-shrug'
	},
	{
		id: 'trap-bar-shrug',
		name: 'Trap Bar Shrug',
		aliases: ['hex bar shrug', 'trap bar shrugs'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Back', secondary: ['Forearms'] },
		pattern: 'shrug',
		variantOf: 'barbell-shrug'
	},
	{
		id: 'back-extension',
		name: 'Back Extension',
		aliases: [
			'hyperextension',
			'back raise',
			'hyper extension',
			'hypers',
			'roman chair back extension'
		],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.45,
		muscles: { primary: 'Back', secondary: ['Glutes', 'Hamstrings'] },
		pattern: 'hinge'
	},

	{
		id: 'overhead-press',
		name: 'Overhead Press',
		aliases: [
			'ohp',
			'military press',
			'shoulder press',
			'standing press',
			'strict press',
			'barbell shoulder press'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps', 'Core'] },
		pattern: 'vertical-press'
	},
	{
		id: 'push-press',
		name: 'Push Press',
		aliases: ['barbell push press', 'push presses'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps', 'Quads', 'Core'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'seated-barbell-press',
		name: 'Seated Barbell Press',
		aliases: [
			'seated overhead press',
			'seated military press',
			'seated barbell shoulder press',
			'seated ohp'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'smith-machine-shoulder-press',
		name: 'Smith Shoulder Press',
		aliases: [
			'smith machine shoulder press',
			'smith overhead press',
			'smith machine overhead press',
			'smith military press'
		],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'landmine-press',
		name: 'Landmine Press',
		aliases: [
			'single arm landmine press',
			'one arm landmine press',
			'landmine shoulder press',
			'half kneeling landmine press'
		],
		equipment: 'Barbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Shoulders', secondary: ['Chest', 'Triceps', 'Core'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'machine-shoulder-press',
		name: 'Machine Shoulder Press',
		aliases: ['shoulder press machine', 'machine overhead press', 'seated machine shoulder press'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'seated-dumbbell-press',
		name: 'Seated DB Press',
		aliases: [
			'db shoulder press',
			'seated dumbbell press',
			'dumbbell shoulder press',
			'dumbbell overhead press',
			'db overhead press',
			'seated shoulder press'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'arnold-press',
		name: 'Arnold Press',
		aliases: ['arnold', 'arnold dumbbell press'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
		pattern: 'vertical-press',
		variantOf: 'overhead-press'
	},
	{
		id: 'upright-row',
		name: 'Upright Row',
		aliases: ['barbell upright row', 'bb upright row'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back', 'Biceps'] },
		pattern: 'raise'
	},
	{
		id: 'cable-upright-row',
		name: 'Cable Upright Row',
		aliases: ['rope upright row', 'cable rope upright row'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back', 'Biceps'] },
		pattern: 'raise',
		variantOf: 'upright-row'
	},
	{
		id: 'front-raise',
		name: 'Front Raise',
		aliases: ['dumbbell front raise', 'db front raise', 'front delt raise', 'anterior raise'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Chest'] },
		pattern: 'raise'
	},
	{
		id: 'cable-front-raise',
		name: 'Cable Front Raise',
		aliases: ['rope front raise', 'cable front delt raise'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Chest'] },
		pattern: 'raise',
		variantOf: 'front-raise'
	},
	{
		id: 'plate-front-raise',
		name: 'Plate Front Raise',
		aliases: ['plate raise', 'weight plate front raise', 'plate front raises'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Chest'] },
		pattern: 'raise',
		variantOf: 'front-raise'
	},
	{
		id: 'lateral-raise',
		name: 'Lateral Raise',
		aliases: [
			'side raise',
			'side lateral',
			'lat raise',
			'db lateral raise',
			'dumbbell lateral raise',
			'side delt raise',
			'laterals'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: [] },
		pattern: 'raise'
	},
	{
		id: 'cable-lateral-raise',
		name: 'Cable Lateral Raise',
		aliases: ['cable side raise', 'cable side lateral', 'cable lat raise'],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Shoulders', secondary: [] },
		pattern: 'raise',
		variantOf: 'lateral-raise'
	},
	{
		id: 'machine-lateral-raise',
		name: 'Machine Lateral Raise',
		aliases: [
			'lateral raise machine',
			'machine lateral raises',
			'machine side raise',
			'lat raise machine',
			'seated lateral raise machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: [] },
		pattern: 'raise',
		variantOf: 'lateral-raise'
	},
	{
		id: 'band-lateral-raise',
		name: 'Band Lateral Raise',
		aliases: ['banded lateral raise', 'band side raise', 'resistance band lateral raise'],
		equipment: 'Band',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: [] },
		pattern: 'raise',
		variantOf: 'lateral-raise'
	},
	{
		id: 'y-raise',
		name: 'Y-Raise',
		aliases: ['incline y raise', 'prone y raise', 'dumbbell y raise', 'db y raise'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'raise'
	},
	{
		id: 'rear-delt-fly',
		name: 'Rear Delt Fly',
		aliases: [
			'reverse fly',
			'rear delt raise',
			'bent over lateral raise',
			'rear fly',
			'db rear delt fly'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'fly'
	},
	{
		id: 'reverse-pec-deck',
		name: 'Reverse Pec Deck',
		aliases: [
			'reverse fly machine',
			'rear delt machine',
			'reverse peck deck',
			'machine rear delt fly',
			'reverse butterfly'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'fly',
		variantOf: 'rear-delt-fly'
	},
	{
		id: 'cable-reverse-fly',
		name: 'Cable Reverse Fly',
		aliases: [
			'unilateral cable reverse fly',
			'single arm cable reverse fly',
			'cable rear delt fly',
			'one arm cable rear delt fly',
			'cable rear delt raise'
		],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'fly',
		variantOf: 'rear-delt-fly'
	},
	{
		id: 'band-pull-apart',
		name: 'Band Pull-Apart',
		aliases: ['pull apart', 'pullapart', 'banded pull apart', 'resistance band pull apart'],
		equipment: 'Band',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'fly',
		variantOf: 'rear-delt-fly'
	},
	{
		id: 'face-pull',
		name: 'Face Pull',
		aliases: ['facepull', 'rope face pull', 'cable face pull'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'horizontal-pull'
	},
	{
		id: 'band-face-pull',
		name: 'Band Face Pull',
		aliases: ['banded face pull', 'resistance band face pull', 'band facepull'],
		equipment: 'Band',
		loadMode: 'total',
		muscles: { primary: 'Shoulders', secondary: ['Back'] },
		pattern: 'horizontal-pull',
		variantOf: 'face-pull'
	},

	{
		id: 'barbell-curl',
		name: 'Barbell Curl',
		aliases: ['bb curl', 'straight bar curl', 'barbell bicep curl'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		pattern: 'curl'
	},
	{
		id: 'ez-bar-curl',
		name: 'EZ-Bar Curl',
		aliases: ['ez curl', 'ez bar bicep curl'],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		pattern: 'curl',
		variantOf: 'barbell-curl'
	},
	{
		id: 'dumbbell-curl',
		name: 'Dumbbell Curl',
		aliases: [
			'db curl',
			'bicep curl',
			'dumbbell bicep curl',
			'db bicep curl',
			'alternating dumbbell curl'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		pattern: 'curl'
	},
	{
		id: 'incline-dumbbell-curl',
		name: 'Incline DB Curl',
		aliases: ['incline curl', 'incline dumbbell curl', 'incline bench curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		pattern: 'curl',
		variantOf: 'dumbbell-curl'
	},
	{
		id: 'hammer-curl',
		name: 'Hammer Curl',
		aliases: ['neutral grip curl', 'dumbbell hammer curl', 'db hammer curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		pattern: 'curl',
		variantOf: 'dumbbell-curl'
	},
	{
		id: 'concentration-curl',
		name: 'Concentration Curl',
		aliases: ['seated concentration curl', 'db concentration curl', 'concentration curls'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Biceps', secondary: [] },
		pattern: 'curl',
		variantOf: 'dumbbell-curl'
	},
	{
		id: 'spider-curl',
		name: 'Spider Curl',
		aliases: ['prone incline curl', 'incline prone curl', 'db spider curl', 'spider curls'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Biceps', secondary: [] },
		pattern: 'curl',
		variantOf: 'dumbbell-curl'
	},
	{
		id: 'preacher-curl',
		name: 'Preacher Curl',
		aliases: ['preacher', 'scott curl', 'ez bar preacher curl'],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: [] },
		pattern: 'curl'
	},
	{
		id: 'dumbbell-preacher-curl',
		name: 'Dumbbell Preacher Curl',
		aliases: [
			'db preacher curl',
			'one arm preacher curl',
			'single arm preacher curl',
			'dumbbell scott curl'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Biceps', secondary: [] },
		pattern: 'curl',
		variantOf: 'preacher-curl'
	},
	{
		id: 'cable-curl',
		name: 'Cable Curl',
		aliases: [
			'rope curl',
			'cable bicep curl',
			'standing cable curl',
			'rope hammer curl',
			'cable hammer curl',
			'ez bar cable curl'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: ['Forearms'] },
		pattern: 'curl',
		grips: {
			label: 'Attachment',
			default: 'bar',
			values: [
				{ id: 'bar', label: 'Straight Bar' },
				{ id: 'ez', label: 'EZ Bar' },
				{ id: 'rope', label: 'Rope' }
			]
		}
	},
	{
		id: 'bayesian-curl',
		name: 'Bayesian Cable Curl',
		aliases: [
			'bayesian curl',
			'behind the body cable curl',
			'face away cable curl',
			'single arm bayesian curl'
		],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Biceps', secondary: [] },
		pattern: 'curl',
		variantOf: 'cable-curl'
	},
	{
		id: 'machine-curl',
		name: 'Machine Curl',
		aliases: [
			'machine biceps curl',
			'machine bicep curl',
			'curl machine',
			'seated machine curl',
			'machine preacher curl',
			'preacher curl machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Biceps', secondary: [] },
		pattern: 'curl',
		variantOf: 'preacher-curl'
	},

	{
		id: 'triceps-pushdown',
		name: 'Triceps Pushdown',
		aliases: [
			'pushdown',
			'rope pushdown',
			'cable pushdown',
			'pressdown',
			'rope pressdown',
			'bar pushdown',
			'v bar pushdown'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension',
		grips: {
			label: 'Attachment',
			default: 'rope',
			values: [
				{ id: 'rope', label: 'Rope' },
				{ id: 'bar', label: 'Straight Bar' },
				{ id: 'v-bar', label: 'V-Bar' }
			]
		}
	},
	{
		id: 'overhead-triceps-extension',
		name: 'Overhead Triceps Extension',
		aliases: [
			'overhead extension',
			'cable overhead extension',
			'rope overhead extension',
			'cable overhead triceps extension'
		],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension',
		grips: {
			label: 'Attachment',
			default: 'rope',
			values: [
				{ id: 'rope', label: 'Rope' },
				{ id: 'bar', label: 'Straight Bar' }
			]
		}
	},
	{
		id: 'dumbbell-overhead-extension',
		name: 'DB Overhead Extension',
		aliases: [
			'dumbbell overhead extension',
			'dumbbell overhead triceps extension',
			'db overhead triceps extension',
			'seated dumbbell extension',
			'db french press'
		],
		equipment: 'Dumbbell',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension',
		variantOf: 'overhead-triceps-extension'
	},
	{
		id: 'ez-bar-overhead-extension',
		name: 'EZ-Bar Overhead Extension',
		aliases: [
			'french press',
			'ez bar french press',
			'ez overhead extension',
			'seated ez bar extension',
			'barbell overhead extension'
		],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension',
		variantOf: 'overhead-triceps-extension'
	},
	{
		id: 'skull-crusher',
		name: 'Skull Crusher',
		aliases: ['lying triceps extension', 'skullcrusher', 'ez bar skull crusher', 'nose breaker'],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension'
	},
	{
		id: 'jm-press',
		name: 'JM Press',
		aliases: ['barbell jm press', 'jm presses'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] },
		pattern: 'extension',
		variantOf: 'skull-crusher'
	},
	{
		id: 'triceps-kickback',
		name: 'Triceps Kickback',
		aliases: [
			'tricep kickback',
			'dumbbell kickback',
			'db kickback',
			'dumbbell triceps kickback',
			'db triceps kickback'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension'
	},
	{
		id: 'cable-triceps-kickback',
		name: 'Cable Triceps Kickback',
		aliases: ['cable tricep kickback', 'single arm cable kickback', 'rope kickback'],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Triceps', secondary: [] },
		pattern: 'extension',
		variantOf: 'triceps-kickback'
	},
	{
		id: 'dip',
		name: 'Dip',
		aliases: ['dips', 'parallel bar dip', 'tricep dip', 'chest dip', 'bar dip', 'weighted dip'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] },
		pattern: 'vertical-press',
		grips: {
			label: 'Lean',
			default: 'upright',
			values: [
				{ id: 'upright', label: 'Upright' },
				{
					id: 'forward',
					label: 'Forward',
					muscles: { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] }
				}
			]
		}
	},
	{
		// A station, not a belt. The bars carry the whole body and the stack carries none of it,
		// so filing the machine under `dip` had the body added on top of the stack — a hundred and
		// sixty on the pin read as a two-hundred-and-fifty-kilo dip, and the est-1RM line swung by
		// the width of a body between one session and the next depending on which was free.
		id: 'machine-dip',
		name: 'Machine Dip',
		aliases: ['dip machine', 'seated dip', 'seated dip machine', 'triceps dip machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Triceps', secondary: ['Chest', 'Shoulders'] },
		pattern: 'vertical-press',
		variantOf: 'dip'
	},
	{
		id: 'bench-dip',
		name: 'Bench Dip',
		aliases: ['bench dips', 'chair dip', 'tricep bench dip', 'triceps bench dip'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.5,
		muscles: { primary: 'Triceps', secondary: ['Shoulders', 'Chest'] },
		pattern: 'vertical-press',
		variantOf: 'dip'
	},

	{
		id: 'wrist-curl',
		name: 'Wrist Curl',
		aliases: ['barbell wrist curl', 'forearm curl'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Forearms', secondary: [] },
		pattern: 'curl'
	},
	{
		id: 'dumbbell-wrist-curl',
		name: 'Dumbbell Wrist Curl',
		aliases: ['db wrist curl', 'dumbbell forearm curl'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Forearms', secondary: [] },
		pattern: 'curl',
		variantOf: 'wrist-curl'
	},
	{
		id: 'reverse-wrist-curl',
		name: 'Reverse Wrist Curl',
		aliases: [
			'wrist extension',
			'reverse forearm curl',
			'barbell wrist extension',
			'reverse barbell wrist curl'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Forearms', secondary: [] },
		pattern: 'extension',
		variantOf: 'wrist-curl'
	},
	{
		id: 'reverse-curl',
		name: 'Reverse Curl',
		aliases: [
			'reverse barbell curl',
			'overhand curl',
			'reverse grip curl',
			'ez bar reverse curl',
			'pronated curl'
		],
		equipment: 'EZ-Bar',
		loadMode: 'total',
		muscles: { primary: 'Forearms', secondary: ['Biceps'] },
		pattern: 'curl'
	},
	{
		id: 'farmers-carry',
		name: "Farmer's Carry",
		aliases: ['farmers walk', 'farmers carry', 'farmer walk', 'loaded carry'],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Forearms', secondary: ['Core'] },
		pattern: 'carry'
	},

	{
		id: 'plank',
		name: 'Plank',
		aliases: ['front plank', 'forearm plank', 'elbow plank'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'brace'
	},
	{
		id: 'side-plank',
		name: 'Side Plank',
		aliases: ['side bridge', 'lateral plank', 'oblique plank'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'brace',
		variantOf: 'plank'
	},
	{
		id: 'crunch',
		name: 'Crunch',
		aliases: ['ab crunch', 'floor crunch', 'abdominal crunch'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'flexion'
	},
	{
		id: 'sit-up',
		name: 'Sit-Up',
		aliases: ['situp', 'sit ups', 'situps', 'floor sit up'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'flexion'
	},
	{
		id: 'decline-sit-up',
		name: 'Decline Sit-Up',
		aliases: ['decline situp', 'decline bench sit up', 'decline sit ups'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'flexion',
		variantOf: 'sit-up'
	},
	{
		id: 'ab-wheel-rollout',
		name: 'Ab Wheel Rollout',
		aliases: ['ab wheel', 'ab rollout', 'ab roller', 'wheel rollout'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: ['Shoulders'] },
		pattern: 'brace'
	},
	{
		id: 'russian-twist',
		name: 'Russian Twist',
		aliases: ['seated twist', 'oblique twist', 'trunk twist'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'rotation'
	},
	{
		id: 'dead-bug',
		name: 'Dead Bug',
		aliases: ['deadbug', 'dead bugs'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'brace'
	},
	{
		id: 'cable-crunch',
		name: 'Cable Crunch',
		aliases: ['kneeling crunch', 'rope crunch', 'kneeling cable crunch', 'cable ab crunch'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'flexion'
	},
	{
		id: 'machine-ab-crunch',
		name: 'Machine Ab Crunch',
		aliases: [
			'ab crunch machine',
			'crunch machine',
			'abdominal crunch machine',
			'ab machine',
			'seated ab crunch',
			'machine crunch'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'flexion'
	},
	{
		id: 'pallof-press',
		name: 'Pallof Press',
		aliases: ['pallof', 'anti rotation press', 'cable pallof press', 'band pallof press'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'brace'
	},
	{
		id: 'cable-woodchop',
		name: 'Cable Woodchop',
		aliases: ['woodchop', 'woodchopper', 'wood chop', 'cable chop', 'cable wood chop'],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'rotation'
	},
	{
		id: 'hanging-leg-raise',
		name: 'Hanging Leg Raise',
		aliases: ['hanging knee raise', 'knee raise', 'hanging knee tuck', 'captains chair leg raise'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 1,
		muscles: { primary: 'Core', secondary: ['Forearms'] },
		pattern: 'flexion'
	},
	{
		id: 'lying-leg-raise',
		name: 'Lying Leg Raise',
		aliases: ['leg raise', 'floor leg raise', 'lying leg raises', 'flat bench leg raise'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0,
		muscles: { primary: 'Core', secondary: [] },
		pattern: 'flexion',
		variantOf: 'hanging-leg-raise'
	},

	{
		id: 'squat',
		name: 'Squat',
		aliases: [
			'back squat',
			'barbell squat',
			'barbell back squat',
			'high bar squat',
			'low bar squat'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings', 'Core'] },
		pattern: 'squat'
	},
	{
		id: 'front-squat',
		name: 'Front Squat',
		aliases: ['barbell front squat', 'front rack squat'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Core'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'goblet-squat',
		name: 'Goblet Squat',
		aliases: [
			'kb goblet squat',
			'dumbbell goblet squat',
			'db goblet squat',
			'kettlebell goblet squat'
		],
		equipment: 'Kettlebell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Core'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'smith-machine-squat',
		name: 'Smith Machine Squat',
		aliases: ['smith squat', 'smith machine back squat'],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'hack-squat',
		name: 'Hack Squat',
		aliases: ['hack squat machine', 'machine squat', 'machine hack squat'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'belt-squat',
		name: 'Belt Squat',
		aliases: ['belt squat machine', 'hip belt squat'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'pendulum-squat',
		name: 'Pendulum Squat',
		aliases: ['pendulum squat machine', 'pendulum'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'box-squat',
		name: 'Box Squat',
		aliases: ['barbell box squat', 'box squats'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings', 'Core'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'safety-bar-squat',
		name: 'Safety Bar Squat',
		aliases: ['ssb squat', 'safety squat bar squat', 'safety squat', 'ssb'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Back', 'Core'] },
		pattern: 'squat',
		variantOf: 'squat'
	},
	{
		id: 'sissy-squat',
		name: 'Sissy Squat',
		aliases: ['sissy squats', 'bodyweight sissy squat'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.7,
		muscles: { primary: 'Quads', secondary: [] },
		pattern: 'squat'
	},
	{
		id: 'leg-press',
		name: 'Leg Press',
		aliases: ['45 degree leg press', 'machine leg press', 'sled leg press', 'incline leg press'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] },
		pattern: 'squat'
	},
	{
		id: 'horizontal-leg-press',
		name: 'Horizontal Leg Press',
		aliases: [
			'seated leg press',
			'selectorized leg press',
			'seated leg press machine',
			'horizontal leg press machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] },
		pattern: 'squat',
		variantOf: 'leg-press'
	},
	{
		id: 'single-leg-press',
		name: 'Single-Leg Press',
		aliases: ['single leg leg press', 'one leg leg press', 'one leg press', 'unilateral leg press'],
		equipment: 'Machine',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] },
		pattern: 'squat',
		variantOf: 'leg-press'
	},
	{
		id: 'leg-extension',
		name: 'Leg Extension',
		aliases: ['quad extension', 'knee extension', 'machine leg extension'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: [] },
		pattern: 'extension'
	},
	{
		id: 'bulgarian-split-squat',
		name: 'Bulgarian Split Squat',
		aliases: ['bss', 'split squat', 'bulgarian squat', 'rear foot elevated split squat', 'rfess'],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes'] },
		pattern: 'lunge'
	},
	{
		id: 'step-up',
		name: 'Step-Up',
		aliases: [
			'stepup',
			'step ups',
			'dumbbell step up',
			'db step up',
			'box step up',
			'bench step up'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] },
		pattern: 'lunge'
	},
	{
		id: 'lunge',
		name: 'Lunge',
		aliases: [
			'walking lunge',
			'lunges',
			'dumbbell lunge',
			'db lunge',
			'forward lunge',
			'reverse lunge'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Quads', secondary: ['Glutes', 'Hamstrings'] },
		pattern: 'lunge'
	},

	{
		id: 'romanian-deadlift',
		name: 'Romanian Deadlift',
		aliases: [
			'rdl',
			'stiff leg deadlift',
			'stiff legged deadlift',
			'barbell rdl',
			'sldl',
			'romanian dl'
		],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes', 'Back'] },
		pattern: 'hinge'
	},
	{
		id: 'dumbbell-romanian-deadlift',
		name: 'Dumbbell RDL',
		aliases: [
			'db rdl',
			'dumbbell romanian deadlift',
			'db romanian deadlift',
			'dumbbell stiff leg deadlift'
		],
		equipment: 'Dumbbell',
		loadMode: 'per-hand',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes'] },
		pattern: 'hinge',
		variantOf: 'romanian-deadlift'
	},
	{
		id: 'single-leg-romanian-deadlift',
		name: 'Single-Leg RDL',
		aliases: [
			'single leg romanian deadlift',
			'single leg deadlift',
			'one leg rdl',
			'sl rdl',
			'single leg db rdl'
		],
		equipment: 'Dumbbell',
		loadMode: 'unilateral',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes', 'Core'] },
		pattern: 'hinge',
		variantOf: 'romanian-deadlift'
	},
	{
		id: 'good-morning',
		name: 'Good Morning',
		aliases: ['goodmorning', 'barbell good morning'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: ['Glutes', 'Back'] },
		pattern: 'hinge'
	},
	{
		id: 'leg-curl',
		name: 'Leg Curl',
		aliases: ['hamstring curl', 'ham curl', 'machine leg curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] },
		pattern: 'curl'
	},
	{
		id: 'seated-leg-curl',
		name: 'Seated Leg Curl',
		aliases: ['seated hamstring curl', 'seated ham curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] },
		pattern: 'curl',
		variantOf: 'leg-curl'
	},
	{
		id: 'lying-leg-curl',
		name: 'Lying Leg Curl',
		aliases: ['prone leg curl', 'lying hamstring curl', 'lying ham curl', 'prone hamstring curl'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Hamstrings', secondary: [] },
		pattern: 'curl',
		variantOf: 'leg-curl'
	},
	{
		id: 'nordic-curl',
		name: 'Nordic Curl',
		aliases: ['nordic hamstring curl', 'nordics', 'nordic curls', 'nordic ham curl'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.8,
		muscles: { primary: 'Hamstrings', secondary: [] },
		pattern: 'curl'
	},
	{
		id: 'glute-ham-raise',
		name: 'Glute-Ham Raise',
		aliases: ['ghr', 'glute ham developer', 'ghd raise', 'natural leg curl'],
		equipment: 'Bodyweight',
		loadMode: 'total',
		bodyweightShare: 0.8,
		muscles: { primary: 'Hamstrings', secondary: ['Glutes'] },
		pattern: 'curl'
	},

	{
		id: 'hip-thrust',
		name: 'Hip Thrust',
		aliases: ['barbell hip thrust', 'bb hip thrust', 'glute thrust'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] },
		pattern: 'hinge'
	},
	{
		id: 'machine-hip-thrust',
		name: 'Machine Hip Thrust',
		aliases: [
			'glute drive',
			'hip thrust machine',
			'plate loaded hip thrust',
			'glute drive machine'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] },
		pattern: 'hinge',
		variantOf: 'hip-thrust'
	},
	{
		id: 'smith-machine-hip-thrust',
		name: 'Smith Machine Hip Thrust',
		aliases: ['smith hip thrust', 'smith glute bridge'],
		equipment: 'Smith Machine',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] },
		pattern: 'hinge',
		variantOf: 'hip-thrust'
	},
	{
		id: 'glute-bridge',
		name: 'Glute Bridge',
		aliases: ['barbell glute bridge', 'floor glute bridge', 'hip bridge'],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] },
		pattern: 'hinge',
		variantOf: 'hip-thrust'
	},
	{
		id: 'hip-abduction',
		name: 'Hip Abduction',
		aliases: [
			'abductor machine',
			'hip abductor',
			'glute abduction',
			'abduction machine',
			'seated hip abduction'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: [] },
		pattern: 'abduction'
	},
	{
		id: 'hip-adduction',
		name: 'Hip Adduction',
		aliases: [
			'adductor machine',
			'hip adductor',
			'inner thigh machine',
			'adduction machine',
			'seated hip adduction'
		],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Quads', secondary: [] },
		pattern: 'adduction'
	},
	{
		id: 'kettlebell-swing',
		name: 'Kettlebell Swing',
		aliases: ['kb swing', 'russian swing', 'two hand swing'],
		equipment: 'Kettlebell',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings', 'Back', 'Core'] },
		pattern: 'hinge'
	},
	{
		id: 'glute-kickback',
		name: 'Glute Kickback',
		aliases: ['cable glute kickback', 'glute kickbacks', 'standing cable kickback'],
		equipment: 'Cable',
		loadMode: 'unilateral',
		muscles: { primary: 'Glutes', secondary: [] },
		pattern: 'extension'
	},
	{
		id: 'machine-glute-kickback',
		name: 'Machine Glute Kickback',
		aliases: ['glute kickback machine', 'glute machine', 'butt blaster', 'machine kickback'],
		equipment: 'Machine',
		loadMode: 'unilateral',
		muscles: { primary: 'Glutes', secondary: [] },
		pattern: 'extension',
		variantOf: 'glute-kickback'
	},
	{
		id: 'cable-pull-through',
		name: 'Cable Pull-Through',
		aliases: ['pull through', 'cable pullthrough', 'rope pull through', 'pull throughs'],
		equipment: 'Cable',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings'] },
		pattern: 'hinge'
	},
	{
		id: 'reverse-hyper',
		name: 'Reverse Hyperextension',
		aliases: ['reverse hyper', 'reverse hypers', 'reverse hyper machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Glutes', secondary: ['Hamstrings', 'Back'] },
		pattern: 'hinge'
	},

	{
		id: 'standing-calf-raise',
		name: 'Standing Calf Raise',
		aliases: ['calf raise', 'machine calf raise', 'calf raise machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] },
		pattern: 'raise'
	},
	{
		id: 'single-leg-calf-raise',
		name: 'Single-Leg Calf Raise',
		aliases: [
			'one leg calf raise',
			'single calf raise',
			'unilateral calf raise',
			'single leg calf raises'
		],
		equipment: 'Bodyweight',
		loadMode: 'unilateral',
		bodyweightShare: 1,
		muscles: { primary: 'Calves', secondary: [] },
		pattern: 'raise',
		variantOf: 'standing-calf-raise'
	},
	{
		id: 'donkey-calf-raise',
		name: 'Donkey Calf Raise',
		aliases: ['donkey raise', 'donkey calves', 'donkey calf raise machine'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] },
		pattern: 'raise',
		variantOf: 'standing-calf-raise'
	},
	{
		id: 'seated-calf-raise',
		name: 'Seated Calf Raise',
		aliases: ['seated calves', 'soleus raise', 'seated machine calf raise'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] },
		pattern: 'raise'
	},
	{
		id: 'calf-press',
		name: 'Calf Press',
		aliases: ['leg press calf raise', 'calf press machine', 'leg press calves'],
		equipment: 'Machine',
		loadMode: 'total',
		muscles: { primary: 'Calves', secondary: [] },
		pattern: 'raise'
	}
];

export const catalogById: Record<string, Exercise> = Object.fromEntries(
	catalog.map((exercise) => [exercise.id, exercise])
);

/**
 * Entries that became a grip on their parent, and what they now read as.
 *
 * A slug is never deleted and never reused, so these keep pointing somewhere forever: an old
 * session, an old plan, a bookmarked URL all still resolve. They are folded on the way out of
 * the store, so nothing downstream ever sees a retired slug — the sets land in the parent's
 * history under the grip they were really performed with, which is the whole point of folding
 * rather than leaving them stranded as entries nobody can reach.
 */
export const FOLDED: Record<string, { id: string; grip: string }> = {
	'close-grip-bench-press': { id: 'bench-press', grip: 'close' },
	'close-grip-lat-pulldown': { id: 'lat-pulldown', grip: 'neutral' },
	'wide-grip-lat-pulldown': { id: 'lat-pulldown', grip: 'wide' },
	'chin-up': { id: 'pull-up', grip: 'underhand' }
};
