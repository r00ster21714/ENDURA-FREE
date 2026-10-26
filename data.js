/* ENDURA data: food nutrition table + exercise library + matching */

const food = (name, kcal, protein, carbs, fat, serveG, aliases = [], serveLabel = '') => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name, kcal, protein, carbs, fat,
  serveG,
  serveLabel: serveLabel || (serveG >= 100 ? `${serveG} g` : `${serveG} g serving`),
  aliases: aliases.map((a) => a.toLowerCase()),
  per100: {
    kcal: Math.round((kcal / serveG) * 1000) / 10,
    protein: Math.round((protein / serveG) * 1000) / 10,
    carbs: Math.round((carbs / serveG) * 1000) / 10,
    fat: Math.round((fat / serveG) * 1000) / 10,
  },
});

/* values are per listed serving; per100 is derived */
export const FOODS = [
  food('Chicken breast', 165, 31, 0, 3.6, 100, ['chicken', 'grilled chicken', 'roast chicken']),
  food('Chicken thigh', 209, 26, 0, 11, 100, ['chicken leg', 'dark meat']),
  food('Ground beef (15%)', 250, 26, 0, 15, 100, ['mince', 'ground meat', 'hamburger patty', 'beef']),
  food('Steak (sirloin)', 271, 25, 0, 18, 100, ['steak', 'sirloin', 'beef steak']),
  food('Pork chop', 242, 27, 0, 14, 100, ['pork']),
  food('Bacon', 541, 37, 1.4, 42, 100, ['streaky bacon']),
  food('Ham', 145, 21, 1.5, 5.5, 100, ['sliced ham']),
  food('Sausage', 301, 12, 2, 27, 100, ['bratwurst', 'hot dog sausage']),
  food('Turkey breast', 189, 29, 0, 7, 100, ['turkey']),
  food('Salmon', 208, 20, 0, 13, 100, ['grilled salmon', 'fish fillet']),
  food('White fish', 82, 18, 0, 0.7, 100, ['cod', 'tilapia', 'haddock', 'fish']),
  food('Tuna (canned)', 132, 28, 0, 1, 100, ['tuna', 'canned tuna']),
  food('Shrimp', 99, 24, 0, 0.3, 100, ['prawn', 'prawns', 'shrimp']),
  food('Egg', 78, 6.3, 0.6, 5.3, 50, ['boiled egg', 'fried egg', 'scrambled egg', 'eggs'], '1 large egg'),
  food('Egg white', 17, 3.6, 0.2, 0.1, 33, ['egg whites'], '1 white'),
  food('Tofu', 76, 8, 1.9, 4.8, 100, ['bean curd', 'firm tofu']),
  food('Whey protein', 120, 24, 3, 1.5, 30, ['protein powder', 'whey', 'protein shake'], '1 scoop'),
  food('Protein bar', 210, 20, 22, 6, 60, ['protein bar'], '1 bar'),
  food('Greek yogurt', 100, 17, 6, 0.7, 170, ['yogurt', 'yoghurt', 'greek yoghurt'], '1 cup'),
  food('Cottage cheese', 98, 11, 3.4, 4.3, 100, ['cottage']),
  food('Milk (2%)', 122, 8, 12, 4.8, 240, ['milk', 'glass of milk'], '1 cup'),
  food('Cheddar cheese', 403, 25, 1.3, 33, 100, ['cheese', 'cheddar']),
  food('Mozzarella', 280, 28, 3.1, 17, 100, ['mozzarella']),
  food('Butter', 102, 0.1, 0, 11.5, 14, ['butter'], '1 tbsp'),
  food('Olive oil', 119, 0, 0, 13.5, 15, ['oil', 'cooking oil'], '1 tbsp'),
  food('Mayonnaise', 94, 0.1, 0.1, 10, 14, ['mayo'], '1 tbsp'),
  food('Peanut butter', 188, 8, 6, 16, 32, ['peanut', 'nut butter'], '2 tbsp'),
  food('Almonds', 164, 6, 6, 14, 28, ['almond', 'nuts'], '1 handful'),
  food('Rice (cooked)', 205, 4.3, 45, 0.4, 158, ['white rice', 'steamed rice', 'rice', 'risotto', 'pilaf'], '1 cup'),
  food('Brown rice (cooked)', 216, 5, 45, 1.8, 195, ['brown rice'], '1 cup'),
  food('Pasta (cooked)', 221, 8, 43, 1.3, 140, ['spaghetti', 'penne', 'noodles', 'pasta', 'carbonara', 'lasagne', 'macaroni'], '1 cup'),
  food('Bread (white)', 79, 2.7, 15, 1, 30, ['toast', 'white bread', 'slice of bread'], '1 slice'),
  food('Bread (whole wheat)', 81, 4, 14, 1.1, 30, ['wholemeal bread', 'brown bread'], '1 slice'),
  food('Bagel', 245, 10, 48, 1.5, 98, ['bagel'], '1 bagel'),
  food('Croissant', 231, 4.7, 26, 12, 57, ['croissant'], '1 croissant'),
  food('Oats (dry)', 150, 5, 27, 3, 40, ['oatmeal', 'porridge', 'oats', 'muesli'], '40 g dry'),
  food('Granola', 471, 10, 64, 20, 100, ['cereal bar']),
  food('Cereal', 150, 3, 34, 0.6, 40, ['cornflakes', 'breakfast cereal'], '1 bowl'),
  food('Pancakes', 175, 4.5, 24, 6.5, 77, ['pancake', 'flapjack'], '2 pancakes'),
  food('Potato (boiled)', 130, 3, 30, 0.2, 170, ['potato', 'boiled potatoes'], '1 medium'),
  food('Mashed potato', 237, 4, 35, 9, 210, ['mash', 'mashed potatoes'], '1 cup'),
  food('French fries', 312, 3.4, 41, 15, 117, ['fries', 'chips', 'french fry'], '1 medium serving'),
  food('Sweet potato', 112, 2, 26, 0.1, 130, ['sweet potato', 'yam'], '1 medium'),
  food('Broccoli', 34, 2.8, 7, 0.4, 100, ['broccoli', 'steamed broccoli']),
  food('Cauliflower', 25, 1.9, 5, 0.3, 100, ['cauliflower']),
  food('Carrot', 25, 0.6, 6, 0.1, 61, ['carrots'], '1 medium'),
  food('Cucumber', 15, 0.7, 3.6, 0.1, 100, ['cucumber', 'gherkin']),
  food('Bell pepper', 26, 1, 6, 0.3, 100, ['pepper', 'capsicum']),
  food('Spinach', 23, 2.9, 3.6, 0.4, 100, ['spinach', 'greens']),
  food('Salad (mixed)', 25, 1.5, 3, 0.3, 150, ['salad', 'green salad', 'side salad'], '1 bowl'),
  food('Caesar salad', 190, 8, 6, 15, 250, ['chicken caesar'], '1 bowl'),
  food('Avocado', 160, 2, 9, 15, 100, ['avocado', 'guacamole'], 'half avocado'),
  food('Banana', 105, 1.3, 27, 0.4, 118, ['banana'], '1 medium'),
  food('Apple', 95, 0.5, 25, 0.3, 182, ['apple', 'granny smith'], '1 medium'),
  food('Orange', 62, 1.2, 15, 0.2, 131, ['orange', 'mandarin'], '1 medium'),
  food('Strawberries', 49, 1, 12, 0.5, 152, ['strawberry', 'berries'], '1 cup'),
  food('Blueberries', 84, 1.1, 21, 0.5, 148, ['blueberry'], '1 cup'),
  food('Grapes', 104, 1.1, 27, 0.2, 151, ['grape'], '1 cup'),
  food('Pineapple', 82, 0.9, 22, 0.2, 165, ['pineapple'], '1 cup'),
  food('Mango', 99, 1.4, 25, 0.6, 165, ['mango'], '1 cup'),
  food('Watermelon', 46, 0.9, 12, 0.2, 152, ['melon'], '1 cup'),
  food('Pizza (cheese)', 285, 12, 36, 10, 107, ['pizza', 'cheese pizza', 'slice of pizza'], '1 slice'),
  food('Cheeseburger', 303, 15, 30, 14, 150, ['burger', 'hamburger', 'cheeseburger'], '1 burger'),
  food('Hot dog', 290, 10, 24, 17, 98, ['hotdog', 'frankfurter'], '1 with bun'),
  food('Burrito', 206, 8, 27, 7, 250, ['wrap', 'burrito bowl'], '1 burrito'),
  food('Taco', 226, 9, 21, 12, 100, ['tacos'], '1 taco'),
  food('Sandwich (deli)', 250, 11, 30, 9, 200, ['sub', 'sandwich'], '1 sandwich'),
  food('Sushi roll', 350, 12, 60, 5, 200, ['sushi', 'maki'], '6 pieces'),
  food('Ramen', 436, 10, 63, 17, 500, ['ramen', 'noodle soup'], '1 bowl'),
  food('Fried rice', 343, 8, 55, 10, 300, ['fried rice'], '1 plate'),
  food('Curry (chicken)', 220, 14, 9, 15, 300, ['curry', 'chicken curry'], '1 bowl'),
  food('Dal (lentils)', 198, 12, 30, 4, 250, ['dal', 'daal', 'lentil soup'], '1 bowl'),
  food('Chapati / roti', 120, 4, 22, 2, 45, ['roti', 'chapati', 'naan'], '1 piece'),
  food('Paneer', 265, 18, 1.2, 21, 100, ['paneer', 'indian cheese']),
  food('Biryani', 290, 12, 40, 9, 300, ['biryani'], '1 plate'),
  food('Idli', 58, 2, 12, 0.2, 40, ['idli'], '2 pieces'),
  food('Dosa', 133, 4, 20, 5, 100, ['dosa'], '1 dosa'),
  food('Lentils (cooked)', 230, 18, 40, 0.8, 200, ['lentils', 'beans'], '1 cup'),
  food('Black beans', 227, 15, 41, 0.9, 172, ['beans', 'kidney beans'], '1 cup'),
  food('Chickpeas', 269, 15, 45, 4.3, 164, ['chickpea', 'hummus base'], '1 cup'),
  food('Quinoa (cooked)', 222, 8, 39, 3.6, 185, ['quinoa'], '1 cup'),
  food('Soup (vegetable)', 80, 3, 12, 2, 300, ['soup', 'broth'], '1 bowl'),
  food('Chocolate', 155, 1.4, 17, 9, 28, ['chocolate bar', 'milk chocolate'], '1 bar'),
  food('Ice cream', 207, 3.5, 24, 11, 100, ['icecream', 'gelato'], '1 scoop'),
  food('Cookie', 148, 1.6, 20, 7, 30, ['biscuit', 'cookies'], '1 cookie'),
  food('Brownie', 240, 3, 30, 12, 56, ['chocolate brownie'], '1 square'),
  food('Muffin', 385, 6, 54, 16, 113, ['blueberry muffin', 'chocolate muffin'], '1 muffin'),
  food('Pretzel', 240, 6, 47, 2, 70, ['soft pretzel'], '1 pretzel'),
  food('Donut', 253, 3, 29, 14, 60, ['doughnut', 'donut'], '1 donut'),
  food('Cake (slice)', 235, 3, 34, 10, 80, ['cake', 'sponge cake'], '1 slice'),
  food('Soda', 140, 0, 39, 0, 330, ['coke', 'cola', 'soft drink', 'soda pop'], '1 can'),
  food('Beer', 153, 1.6, 13, 0, 355, ['beer', 'lager', 'ale'], '1 bottle'),
  food('Wine (red)', 125, 0.1, 3.8, 0, 150, ['wine', 'red wine'], '1 glass'),
  food('Coffee (black)', 2, 0.3, 0, 0, 240, ['espresso', 'americano', 'black coffee'], '1 cup'),
  food('Latte', 120, 8, 10, 5, 300, ['cappuccino', 'flat white', 'coffee with milk'], '1 cup'),
  food('Orange juice', 112, 1.7, 26, 0.5, 248, ['juice', 'oj'], '1 cup'),
  food('Smoothie', 180, 4, 38, 1.5, 350, ['fruit smoothie', 'shake'], '1 cup'),
  food('Honey', 64, 0.1, 17, 0, 21, ['honey'], '1 tbsp'),
  food('Ketchup', 15, 0.2, 4, 0, 15, ['tomato sauce'], '1 tbsp'),
  food('Hummus', 70, 2, 6, 5, 30, ['houmous'], '2 tbsp'),
  food('Olives', 42, 0.3, 1.5, 4, 30, ['olive'], '10 olives'),
];

/* ---------------- exercise library ---------------- */

export const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'];

const ex = (name, group, gear = 'Barbell', rest = 90, unit = 'kg') => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name, group, gear, rest, unit,
});

export const EXERCISES = [
  ex('Bench press', 'Chest', 'Barbell', 150),
  ex('Incline bench press', 'Chest', 'Barbell', 150),
  ex('Dumbbell bench press', 'Chest', 'Dumbbell', 120),
  ex('Incline dumbbell press', 'Chest', 'Dumbbell', 120),
  ex('Chest fly', 'Chest', 'Cable', 75),
  ex('Pec deck', 'Chest', 'Machine', 75),
  ex('Push-up', 'Chest', 'Bodyweight', 60, 'bw'),
  ex('Dip', 'Chest', 'Bodyweight', 90, 'bw'),
  ex('Cable crossover', 'Chest', 'Cable', 75),

  ex('Deadlift', 'Back', 'Barbell', 180),
  ex('Romanian deadlift', 'Back', 'Barbell', 150),
  ex('Barbell row', 'Back', 'Barbell', 120),
  ex('Pull-up', 'Back', 'Bodyweight', 120, 'bw'),
  ex('Chin-up', 'Back', 'Bodyweight', 120, 'bw'),
  ex('Lat pulldown', 'Back', 'Cable', 90),
  ex('Seated cable row', 'Back', 'Cable', 90),
  ex('Single-arm dumbbell row', 'Back', 'Dumbbell', 90),
  ex('T-bar row', 'Back', 'Machine', 120),
  ex('Straight-arm pulldown', 'Back', 'Cable', 60),
  ex('Back extension', 'Back', 'Bodyweight', 60),

  ex('Overhead press', 'Shoulders', 'Barbell', 150),
  ex('Dumbbell shoulder press', 'Shoulders', 'Dumbbell', 120),
  ex('Arnold press', 'Shoulders', 'Dumbbell', 120),
  ex('Lateral raise', 'Shoulders', 'Dumbbell', 60),
  ex('Rear delt fly', 'Shoulders', 'Dumbbell', 60),
  ex('Face pull', 'Shoulders', 'Cable', 60),
  ex('Upright row', 'Shoulders', 'Barbell', 75),
  ex('Shrug', 'Shoulders', 'Dumbbell', 90),

  ex('Barbell curl', 'Arms', 'Barbell', 75),
  ex('Dumbbell curl', 'Arms', 'Dumbbell', 60),
  ex('Hammer curl', 'Arms', 'Dumbbell', 60),
  ex('Preacher curl', 'Arms', 'Machine', 60),
  ex('Cable triceps pushdown', 'Arms', 'Cable', 60),
  ex('Skull crusher', 'Arms', 'Barbell', 75),
  ex('Overhead triceps extension', 'Arms', 'Dumbbell', 60),
  ex('Close-grip bench press', 'Arms', 'Barbell', 120),
  ex('Wrist curl', 'Arms', 'Dumbbell', 45),

  ex('Back squat', 'Legs', 'Barbell', 180),
  ex('Front squat', 'Legs', 'Barbell', 180),
  ex('Hack squat', 'Legs', 'Machine', 150),
  ex('Leg press', 'Legs', 'Machine', 120),
  ex('Bulgarian split squat', 'Legs', 'Dumbbell', 120),
  ex('Walking lunge', 'Legs', 'Dumbbell', 90),
  ex('Leg extension', 'Legs', 'Machine', 75),
  ex('Leg curl', 'Legs', 'Machine', 75),
  ex('Hip thrust', 'Legs', 'Barbell', 120),
  ex('Standing calf raise', 'Legs', 'Machine', 60),
  ex('Seated calf raise', 'Legs', 'Machine', 60),
  ex('Good morning', 'Legs', 'Barbell', 90),
  ex('Sumo deadlift', 'Legs', 'Barbell', 180),
  ex('Step-up', 'Legs', 'Dumbbell', 75),
  ex('Kettlebell swing', 'Legs', 'Kettlebell', 60),

  ex('Plank', 'Core', 'Bodyweight', 60, 'time'),
  ex('Hanging leg raise', 'Core', 'Bodyweight', 60, 'bw'),
  ex('Cable crunch', 'Core', 'Cable', 60),
  ex('Crunch', 'Core', 'Bodyweight', 45, 'bw'),
  ex('Russian twist', 'Core', 'Plate', 45),
  ex('Ab wheel rollout', 'Core', 'Bodyweight', 60, 'bw'),
  ex('Side plank', 'Core', 'Bodyweight', 45, 'time'),

  ex('Treadmill run', 'Cardio', 'Machine', 0, 'time'),
  ex('Rowing machine', 'Cardio', 'Machine', 0, 'time'),
  ex('Stationary bike', 'Cardio', 'Machine', 0, 'time'),
  ex('Jump rope', 'Cardio', 'Bodyweight', 45, 'time'),
  ex('Box jump', 'Cardio', 'Bodyweight', 60, 'bw'),
  ex('Burpee', 'Cardio', 'Bodyweight', 45, 'bw'),
  ex('Stair climber', 'Cardio', 'Machine', 0, 'time'),
];

export const exerciseById = (id) => EXERCISES.find((e) => e.id === id) || { id, name: id, group: 'Other', gear: '', rest: 90, unit: 'kg' };

/* ---------------- search / matching ---------------- */

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function searchFoods(q, limit = 40) {
  const query = norm(q);
  if (!query) return FOODS.slice(0, limit);
  const terms = query.split(' ').filter(Boolean);
  const scored = [];
  for (const f of FOODS) {
    const hay = norm(f.name + ' ' + f.aliases.join(' '));
    let score = 0;
    for (const t of terms) {
      if (hay.split(' ').some((w) => w === t)) score += 6;
      else if (hay.includes(t)) score += 3;
      else if (f.name.toLowerCase().startsWith(t)) score += 2;
    }
    if (score > 0) scored.push({ f, score: score + (f.aliases.some((a) => a === query) ? 4 : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.f);
}

export function searchExercises(q, limit = 40) {
  const query = norm(q);
  if (!query) return EXERCISES.slice(0, limit);
  const terms = query.split(' ').filter(Boolean);
  return EXERCISES
    .map((e) => {
      const hay = norm(e.name + ' ' + e.group + ' ' + e.gear);
      let score = 0;
      for (const t of terms) {
        if (norm(e.name).startsWith(t)) score += 5;
        else if (hay.split(' ').some((w) => w === t)) score += 4;
        else if (hay.includes(t)) score += 2;
      }
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

/* ---------------- classifier labels → food ---------------- */

/*
 * ImageNet knows "bagel" and "dough" but not "chocolate chip cookie", so a
 * confident single answer is often a lie. Two things keep it honest:
 *   1. strict label matching (no "dough" → "donut" substring nonsense)
 *   2. visual families: a generic baked-goods label expands to the whole
 *      bakery shelf, so the right item is on screen instead of a wrong one.
 */
export const VISUAL_FAMILIES = [
  {
    id: 'bakery',
    name: 'baked goods',
    triggers: ['dough', 'bagel', 'beigel', 'pretzel', 'french loaf', 'bread', 'bakery', 'bun',
      'croissant', 'waffle', 'pancake', 'muffin', 'cake', 'cookie', 'biscuit', 'pastry',
      'doughnut', 'donut', 'toast', 'loaf', 'pita', 'focaccia', 'baguette'],
    foods: ['Cookie', 'Brownie', 'Muffin', 'Donut', 'Bagel', 'Croissant', 'Cake (slice)',
      'Pancakes', 'Bread (white)', 'Bread (whole wheat)'],
  },
  {
    id: 'dessert',
    name: 'dessert',
    triggers: ['ice cream', 'icecream', 'gelato', 'chocolate sauce', 'trifle', 'custard',
      'cake', 'cookie', 'brownie', 'cheesecake', 'candy', 'confectionery'],
    foods: ['Ice cream', 'Cookie', 'Cake (slice)', 'Chocolate', 'Donut', 'Brownie'],
  },
  {
    id: 'fastfood',
    name: 'fast food',
    triggers: ['cheeseburger', 'hamburger', 'hot dog', 'hotdog', 'french fries', 'fries',
      'pizza', 'burrito', 'taco', 'sandwich', 'pretzel', 'hoagie', 'grinder'],
    foods: ['Cheeseburger', 'Pizza (cheese)', 'Hot dog', 'Sandwich (deli)', 'Burrito',
      'Taco', 'French fries'],
  },
  {
    id: 'rice',
    name: 'rice or noodles',
    triggers: ['rice', 'risotto', 'pilaf', 'biryani', 'curry', 'carbonara', 'spaghetti',
      'lasagne', 'noodles', 'ramen', 'paella', 'burrito'],
    foods: ['Rice (cooked)', 'Brown rice (cooked)', 'Pasta (cooked)', 'Fried rice',
      'Biryani', 'Ramen', 'Burrito'],
  },
  {
    id: 'breakfast',
    name: 'breakfast',
    triggers: ['pancake', 'waffle', 'omelette', 'scrambled egg', 'fried egg', 'egg',
      'bacon', 'cereal', 'oatmeal', 'granola', 'toast', 'porridge'],
    foods: ['Pancakes', 'Egg', 'Oats (dry)', 'Cereal', 'Bacon', 'Bread (white)',
      'Greek yogurt'],
  },
  {
    id: 'salad',
    name: 'salad or vegetables',
    triggers: ['salad', 'broccoli', 'cauliflower', 'cucumber', 'bell pepper',
      'head cabbage', 'zucchini', 'vegetable', 'artichoke', 'mushroom'],
    foods: ['Salad (mixed)', 'Broccoli', 'Cauliflower', 'Cucumber', 'Bell pepper', 'Spinach'],
  },
  {
    id: 'meat',
    name: 'meat or fish',
    triggers: ['steak', 'meat', 'beef', 'pork', 'chicken', 'fish', 'salmon', 'shrimp',
      'lobster', 'crab', 'bacon', 'ham', 'sausage'],
    foods: ['Chicken breast', 'Steak (sirloin)', 'Ground beef (15%)', 'Pork chop',
      'Salmon', 'Shrimp', 'Turkey breast'],
  },
];

export const matchLabels = (predictions, learned) => matchVisual(predictions, learned).candidates;

/**
 * @param {Array<{label:string, score:number}>} predictions
 * @param {Record<string,{id:string,n:number}>} [learned] corrections the user made before
 * @returns {{candidates:Array, family:string|null, saw:string[], sure:boolean}}
 */
export function matchVisual(predictions, learned = {}) {
  const out = new Map();
  const add = (food, score, why) => {
    const cur = out.get(food.id);
    if (!cur || cur.score < score) out.set(food.id, { food, score, why });
  };

  const familyScore = new Map();

  for (const p of predictions) {
    const score = Math.max(0, Number(p.score) || 0);
    if (!score) continue;
    const raw = String(p.label || '');
    const label = norm(raw.split(',')[0]);
    const full = norm(raw);
    if (!label) continue;

    for (const f of FOODS) {
      const names = [norm(f.name), ...f.aliases.map(norm)];
      if (names.some((n) => aliasMatch(label, n))) add(f, score, 'direct');
    }

    for (const fam of VISUAL_FAMILIES) {
      if (!fam.triggers.some((t) => full.includes(t) || label.includes(t))) continue;
      familyScore.set(fam.id, (familyScore.get(fam.id) || 0) + score);
      for (const name of fam.foods) {
        const f = FOODS.find((x) => x.name === name);
        if (f) add(f, score * 0.72, fam.id);
      }
    }
  }

  // A label the user already corrected wins next time. Keyed on the exact
  // top label, so "dough" can mean cookie without touching "bagel".
  const topLabel = predictions.length ? norm(String(predictions[0].label || '').split(',')[0]) : '';
  const remembered = topLabel ? learned[topLabel] : null;
  if (remembered && remembered.id) {
    const f = FOODS.find((x) => x.id === remembered.id);
    const best = Math.max(0, ...[...out.values()].map((c) => c.score));
    if (f) add(f, Math.max(best * 1.2, 0.35), 'learned');
  }

  const sorted = [...out.values()].sort((a, b) => b.score - a.score);
  if (!sorted.length) return { candidates: [], family: null, saw: [], sure: false };

  const family = [...familyScore.entries()].sort((a, b) => b[1] - a[1])[0];
  const fam = family ? VISUAL_FAMILIES.find((f) => f.id === family[0]) : null;
  const direct = sorted.find((c) => c.why === 'direct');

  return {
    candidates: sorted.slice(0, fam ? 6 : 4),
    family: fam ? fam.name : null,
    saw: predictions.slice(0, 3).map((p) => String(p.label || '').split(',')[0]).filter(Boolean),
    sure: !!direct && direct.score >= 0.55,
  };
}

/** Whole-word label/alias match — "dough" must not match "doughnut". */
function aliasMatch(label, alias) {
  if (!label || !alias) return false;
  if (label === alias) return true;
  if (alias.split(' ').includes(label)) return true;
  if (label.split(' ').includes(alias)) return true;
  return false;
}
