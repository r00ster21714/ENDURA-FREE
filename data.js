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
  food('Chicken breast', 165, 31, 0, 3.6, 100, ['chicken', 'grilled chicken', 'roast chicken', 'roast chicken breast', 'chicken fillet']),
  food('Chicken thigh', 209, 26, 0, 11, 100, ['chicken leg', 'dark meat']),
  food('Ground beef (15%)', 250, 26, 0, 15, 100, ['mince', 'minced beef', 'ground meat', 'hamburger patty', 'beef', 'meat loaf', 'meatloaf']),
  food('Steak (sirloin)', 271, 25, 0, 18, 100, ['steak', 'sirloin', 'beef steak', 'sirloin steak', 'ribeye', 'rib eye', 'flank steak', 'grilled steak']),
  food('Pork chop', 242, 27, 0, 14, 100, ['pork', 'pork steak']),
  food('Bacon', 541, 37, 1.4, 42, 100, ['streaky bacon']),
  food('Ham', 145, 21, 1.5, 5.5, 100, ['sliced ham']),
  food('Sausage', 301, 12, 2, 27, 100, ['bratwurst', 'hot dog sausage']),
  food('Turkey breast', 189, 29, 0, 7, 100, ['turkey']),
  food('Salmon', 208, 20, 0, 13, 100, ['grilled salmon', 'fish fillet']),
  food('White fish', 82, 18, 0, 0.7, 100, ['cod', 'tilapia', 'haddock', 'fish']),
  food('Tuna (canned)', 132, 28, 0, 1, 100, ['tuna', 'canned tuna']),
  food('Shrimp', 99, 24, 0, 0.3, 100, ['prawn', 'prawns', 'shrimp']),
  food('Egg', 78, 6.3, 0.6, 5.3, 50, ['boiled egg', 'fried egg', 'scrambled egg', 'eggs', 'omelette', 'omelet'], '1 large egg'),
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
  food('Rice (cooked)', 205, 4.3, 45, 0.4, 158, ['white rice', 'steamed rice', 'boiled rice', 'basmati rice', 'jasmine rice', 'long grain rice', 'rice', 'risotto', 'pilaf'], '1 cup'),
  food('Brown rice (cooked)', 216, 5, 45, 1.8, 195, ['brown rice', 'wholegrain rice'], '1 cup'),
  food('Pasta (cooked)', 221, 8, 43, 1.3, 140, ['spaghetti', 'penne', 'noodles', 'pasta', 'carbonara', 'lasagne', 'macaroni', 'fusilli', 'rigatoni', 'linguine', 'fettuccine', 'macaroni cheese'], '1 cup'),
  food('Bread (white)', 79, 2.7, 15, 1, 30, ['toast', 'white bread', 'slice of bread'], '1 slice'),
  food('Bread (whole wheat)', 81, 4, 14, 1.1, 30, ['wholemeal bread', 'brown bread'], '1 slice'),
  food('Bagel', 245, 10, 48, 1.5, 98, ['bagel'], '1 bagel'),
  food('Croissant', 231, 4.7, 26, 12, 57, ['croissant'], '1 croissant'),
  food('Cinnamon roll', 380, 5, 56, 15, 100, ['cinnamon bun', 'cinnamon swirl', 'cinnamon scroll', 'sticky bun', 'sweet roll', 'iced bun', 'cinnamon pastry'], '1 roll'),
  food('Sourdough bread', 135, 5.2, 26, 0.9, 50, ['sourdough', 'french loaf', 'artisan bread', 'rustic bread', 'baguette', 'pan loaf'], '1 thick slice'),
  food('Bread roll', 185, 6, 33, 3, 60, ['dinner roll', 'bread bun', 'burger bun', 'roll', 'bun', 'cob'], '1 roll'),
  food('Danish pastry', 340, 5.4, 40, 18, 90, ['danish', 'pain au chocolat', 'cheese danish', 'viennoiserie'], '1 pastry'),
  food('Scone', 220, 4, 32, 8, 60, ['scones', 'cream scone', 'tea biscuit'], '1 scone'),
  food('Banana bread', 230, 3.4, 34, 9, 70, ['banana loaf', 'zucchini bread', 'pumpkin bread', 'loaf cake'], '1 slice'),
  food('Churro', 270, 3, 30, 15, 60, ['churros'], '1 churro'),
  food('Waffle', 218, 5.5, 25, 11, 75, ['waffles', 'belgian waffle'], '1 waffle'),
  food('French toast', 275, 10, 28, 13, 120, ['eggy bread', 'pain perdu'], '2 slices'),
  food('Coffee cake', 300, 4, 44, 12, 80, ['crumb cake', 'streusel cake'], '1 slice'),
  food('Cupcake', 305, 3.4, 43, 14, 80, ['fairy cake', 'frosted cupcake'], '1 cupcake'),
  food('Cheesecake', 321, 5.5, 25, 22, 100, ['new york cheesecake'], '1 slice'),
  food('Pie (fruit)', 340, 3, 47, 16, 125, ['apple pie', 'pumpkin pie', 'pie', 'fruit pie', 'tart'], '1 slice'),
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

  /* Whole-plate dishes. A photo of steak and rice is two foods, and no single
     ImageNet label can name it — but refusing to answer pushed the work back
     onto the person holding the phone. These carry realistic macros for a
     normal serving so a plate still gets a name and a number in one tap. */
  food('Meat and rice', 620, 40, 62, 18, 450, ['steak and rice', 'beef and rice', 'meat and rice', 'steak rice']),
  food('Chicken and rice', 560, 40, 58, 14, 450, ['chicken and rice', 'chicken rice bowl']),
  food('Fish and rice', 520, 34, 58, 12, 450, ['fish and rice', 'salmon and rice', 'tuna and rice']),
  food('Meat and pasta', 660, 32, 70, 24, 450, ['steak pasta', 'beef pasta', 'meat pasta', 'bolognese', 'meat sauce pasta']),
  food('Chicken and pasta', 600, 34, 68, 18, 450, ['chicken pasta', 'chicken alfredo']),
  food('Fish and pasta', 560, 30, 66, 16, 450, ['fish pasta', 'salmon pasta']),
  food('Meat and potatoes', 580, 32, 52, 24, 400, ['steak and potatoes', 'meat and potatoes', 'bangers and mash']),
  food('Chicken and potatoes', 520, 34, 50, 18, 400, ['chicken and potatoes', 'chicken and chips']),
  food('Meat and vegetables', 420, 34, 18, 24, 400, ['meat and veg', 'steak and veg', 'meat and vegetables']),
  food('Chicken and vegetables', 380, 36, 16, 18, 400, ['chicken and veg', 'chicken and broccoli', 'chicken and vegetables']),
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
 * ImageNet knows "bagel" and "dough" but not "steak", "rice" or "cinnamon
 * roll", so a confident single answer from it is often a lie. Facts that drive
 * the design:
 *   - a plate of steak and rice trips "dough" (white mounds) and "carbonara"
 *     (brown + pale), never "steak" or "rice" — those are not classes
 *   - "dough" is a generic label, so expanding it straight to Cinnamon roll is
 *     a fabrication; it should only reach generic bread
 *   - two thirds of meal photos are savoury, and sweet families were winning
 *     ties against meat because their shelf weights were highest
 *
 * So: strict whole-word matching, direct hits always outrank family guesses,
 * a specific trigger is required for a specific pastry, sweet families are
 * damped unless the photo actually says something sweet, and a plated frame
 * with savoury evidence is reported as a mixed plate instead of one wrong dish.
 */
const SWEET_FAMILIES = new Set(['bakery', 'dessert']);
const SAVOURY_FAMILIES = ['meat', 'rice', 'salad', 'fastfood', 'breakfast'];

/* Terms specific enough to justify naming that exact item. */
const SPECIFIC = new Set([
  'cinnamon', 'cinnamon roll', 'cinnamon bun', 'cinnamon swirl', 'sticky bun',
  'iced bun', 'sweet roll', 'icing', 'frosting', 'cheesecake', 'cupcake',
  'muffin', 'cookie', 'biscuit', 'doughnut', 'donut', 'waffle', 'waffles',
  'pancake', 'pancakes', 'brownie', 'pie', 'apple pie', 'pumpkin pie', 'tart',
  'cake', 'sponge cake', 'chocolate cake', 'ice cream', 'icecream', 'gelato',
  'chocolate', 'scone', 'french toast', 'banana bread', 'coffee cake',
  'pretzel', 'churro', 'croissant', 'danish', 'pain au chocolat', 'bagel',
]);

/* Shape cues: MobileNet says "coil, spiral, volute, whorl, helix" about a
   cinnamon roll. Only trusted when a bakery shelf also fired, so a nautilus
   shell does not become breakfast. */
const SHAPE_HINTS = [
  { food: 'Cinnamon roll', terms: ['coil', 'spiral', 'volute', 'whorl', 'helix'], fams: ['bakery', 'dessert'], mul: 1.7 },
];

export const VISUAL_FAMILIES = [
  {
    id: 'bakery',
    name: 'baked goods',
    triggers: ['dough', 'bagel', 'beigel', 'pretzel', 'french loaf', 'bread', 'bakery', 'bun',
      'croissant', 'waffle', 'pancake', 'muffin', 'cake', 'cookie', 'biscuit', 'pastry',
      'doughnut', 'donut', 'toast', 'loaf', 'pita', 'focaccia', 'baguette', 'roll', 'scone',
      'cinnamon', 'icing', 'frosting', 'sweet roll', 'viennoiserie', 'brioche'],
    foods: [
      // [food, weight, needs?] — `needs` gating: without one of those exact
      // terms firing, the item is heavily damped. Generic "dough"/"bakery"
      // must not produce "Cinnamon roll".
      ['Sourdough bread', 0.94],
      ['Bread roll', 0.93],
      ['Bread (white)', 0.9],
      ['Bread (whole wheat)', 0.87],
      ['Bagel', 0.88, ['bagel', 'beigel']],
      ['Croissant', 0.86, ['croissant']],
      ['Danish pastry', 0.8, ['danish', 'pain au chocolat', 'viennoiserie']],
      ['Cinnamon roll', 1, ['cinnamon', 'cinnamon roll', 'cinnamon bun', 'cinnamon swirl',
        'sticky bun', 'iced bun', 'sweet roll', 'cinnamon pastry']],
      ['Pretzel', 0.82, ['pretzel']],
      ['Muffin', 0.84, ['muffin']],
      ['Donut', 0.84, ['doughnut', 'donut']],
      ['Cookie', 0.84, ['cookie', 'biscuit']],
      ['Cake (slice)', 0.82, ['cake', 'sponge cake']],
      ['Waffle', 0.8, ['waffle', 'waffles']],
      ['Pancakes', 0.78, ['pancake', 'pancakes']],
      ['Scone', 0.78, ['scone', 'scones']],
      ['Banana bread', 0.76, ['banana bread', 'banana loaf', 'loaf cake']],
      ['Coffee cake', 0.74, ['coffee cake', 'crumb cake', 'streusel cake']],
      ['Churro', 0.74, ['churro', 'churros']],
      ['Brownie', 0.72, ['brownie']],
    ],
  },
  {
    id: 'dessert',
    name: 'dessert',
    triggers: ['ice cream', 'icecream', 'gelato', 'chocolate sauce', 'trifle', 'custard',
      'cake', 'cookie', 'brownie', 'cheesecake', 'candy', 'confectionery', 'pastry'],
    foods: [
      ['Cheesecake', 1, ['cheesecake']],
      ['Cupcake', 0.96, ['cupcake']],
      ['Pie (fruit)', 0.94, ['pie', 'apple pie', 'pumpkin pie', 'fruit pie', 'tart']],
      ['Cake (slice)', 0.9, ['cake', 'sponge cake']],
      ['Brownie', 0.9, ['brownie']],
      ['Cookie', 0.88, ['cookie', 'biscuit']],
      ['Ice cream', 0.86, ['ice cream', 'icecream', 'gelato']],
      ['Chocolate', 0.82, ['chocolate']],
      ['Donut', 0.8, ['doughnut', 'donut']],
    ],
  },
  {
    id: 'fastfood',
    name: 'fast food',
    triggers: ['cheeseburger', 'hamburger', 'hot dog', 'hotdog', 'french fries', 'fries',
      'pizza', 'burrito', 'taco', 'sandwich', 'hoagie', 'grinder'],
    foods: [
      ['Cheeseburger', 1],
      ['Pizza (cheese)', 0.95],
      ['Hot dog', 0.9],
      ['Sandwich (deli)', 0.88],
      ['Burrito', 0.86],
      ['Taco', 0.84],
      ['French fries', 0.8],
    ],
  },
  {
    id: 'rice',
    name: 'rice or noodles',
    triggers: ['rice', 'risotto', 'pilaf', 'biryani', 'curry', 'carbonara', 'spaghetti',
      'lasagne', 'noodles', 'ramen', 'paella', 'burrito'],
    foods: [
      ['Rice (cooked)', 1, ['rice', 'risotto', 'pilaf', 'paella', 'curry']],
      ['Brown rice (cooked)', 0.95, ['rice', 'brown rice']],
      ['Pasta (cooked)', 1, ['carbonara', 'spaghetti', 'lasagne', 'noodles', 'pasta']],
      ['Fried rice', 0.92, ['rice', 'fried rice']],
      ['Biryani', 0.9, ['biryani']],
      ['Ramen', 0.9, ['ramen', 'noodles']],
      ['Burrito', 0.82, ['burrito']],
    ],
  },
  {
    id: 'breakfast',
    name: 'breakfast',
    triggers: ['pancake', 'waffle', 'omelette', 'scrambled egg', 'fried egg', 'egg',
      'bacon', 'cereal', 'oatmeal', 'granola', 'toast', 'porridge', 'french toast'],
    foods: ['Pancakes', 'Waffle', 'French toast', 'Egg', 'Oats (dry)', 'Cereal', 'Bacon',
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
    triggers: ['steak', 'meat', 'beef', 'pork', 'chicken', 'turkey', 'fish', 'salmon', 'shrimp',
      'lobster', 'crab', 'bacon', 'ham', 'sausage'],
    foods: [
      ['Steak (sirloin)', 1, ['steak', 'beef']],
      ['Chicken breast', 0.95, ['chicken', 'turkey']],
      ['Ground beef (15%)', 0.92, ['beef', 'meat', 'steak']],
      ['Pork chop', 0.9, ['pork']],
      ['Salmon', 0.88, ['salmon', 'fish']],
      ['Shrimp', 0.84, ['shrimp', 'crab', 'lobster']],
      ['Turkey breast', 0.8, ['turkey', 'chicken']],
    ],
  },
];

/*
 * Labels that describe the table rather than the food. They used to eat a slot
 * in the top-3 and kill an otherwise good match, so they are skipped for
 * matching and only shown when nothing better is on offer.
 */
const NON_FOOD = new Set([
  'plate', 'plate rack', 'tray', 'cup', 'mug', 'coffee mug', 'soup bowl', 'bowl', 'tableware',
  'dining table', 'menu', 'restaurant', 'grocery store', 'refrigerator', 'wooden spoon',
  'spatula', 'ladle', 'frying pan', 'wok', 'pot', 'dutch oven', 'cutting board', 'napkin',
  'packet', 'carton', 'water bottle', 'pop bottle', 'beer bottle', 'wine bottle', 'bottle',
  'mixing bowl', 'saltshaker', 'doily', 'apron', 'table lamp', 'monitor', 'screen', 'website',
]);

/*
 * Coarse fingerprint per food, used only to order candidates inside a family:
 * light (0 dark .. 1 white), sat (0 grey .. 1 vivid), warm (0.5 neutral,
 * higher = red/golden), tex (0 smooth .. 1 busy). Rough by design — it is a
 * tie-breaker, not a classifier.
 */
const LOOK = {
  'cinnamon-roll': { light: 0.5, sat: 0.42, warm: 0.66, tex: 0.5 },
  croissant: { light: 0.57, sat: 0.48, warm: 0.68, tex: 0.55 },
  'sourdough-bread': { light: 0.62, sat: 0.3, warm: 0.62, tex: 0.32 },
  'bread-roll': { light: 0.6, sat: 0.32, warm: 0.62, tex: 0.3 },
  bagel: { light: 0.52, sat: 0.36, warm: 0.63, tex: 0.36 },
  'danish-pastry': { light: 0.56, sat: 0.42, warm: 0.66, tex: 0.48 },
  muffin: { light: 0.4, sat: 0.4, warm: 0.63, tex: 0.46 },
  donut: { light: 0.56, sat: 0.45, warm: 0.6, tex: 0.36 },
  cookie: { light: 0.36, sat: 0.46, warm: 0.66, tex: 0.48 },
  'cake-slice': { light: 0.62, sat: 0.3, warm: 0.58, tex: 0.26 },
  waffle: { light: 0.5, sat: 0.5, warm: 0.68, tex: 0.56 },
  pancakes: { light: 0.55, sat: 0.45, warm: 0.66, tex: 0.24 },
  scone: { light: 0.6, sat: 0.3, warm: 0.6, tex: 0.4 },
  'banana-bread': { light: 0.36, sat: 0.44, warm: 0.64, tex: 0.36 },
  'coffee-cake': { light: 0.44, sat: 0.4, warm: 0.64, tex: 0.42 },
  brownie: { light: 0.2, sat: 0.4, warm: 0.6, tex: 0.32 },
  cheesecake: { light: 0.68, sat: 0.28, warm: 0.58, tex: 0.22 },
  cupcake: { light: 0.55, sat: 0.42, warm: 0.6, tex: 0.34 },
  'pie-fruit': { light: 0.46, sat: 0.48, warm: 0.66, tex: 0.44 },
  'bread-white': { light: 0.68, sat: 0.22, warm: 0.58, tex: 0.26 },
  'bread-whole-wheat': { light: 0.46, sat: 0.34, warm: 0.62, tex: 0.32 },
};

const LOOK_W = { light: 1, sat: 0.7, warm: 1.1, tex: 0.8 };

/** 0..1 similarity between a food's fingerprint and the photo's stats. */
export function lookAffinity(foodId, features) {
  const look = LOOK[foodId];
  if (!look || !features) return 1;
  let dist = 0;
  let total = 0;
  for (const k of Object.keys(LOOK_W)) {
    const a = look[k];
    const b = features[k];
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    dist += Math.min(1, Math.abs(a - b)) * LOOK_W[k];
    total += LOOK_W[k];
  }
  return total ? 1 - dist / total : 1;
}

const nudge = (v, lo = 0.88, hi = 1.12) => Math.min(hi, Math.max(lo, v));

/* Whole-word trigger test: "chambered nautilus" must not trip the "ham" trigger. */
const hasTerm = (hay, term) => (' ' + hay + ' ').includes(' ' + term + ' ');

export const matchLabels = (predictions, learned) => matchVisual(predictions, learned).candidates;

/**
 * @param {Array<{label:string, score:number}>} predictions
 * @param {Record<string,{id:string,n:number}>} [learned] corrections the user made before
 * @param {{light:number,sat:number,warm:number,tex:number}} [features] from vision.imageFeatures
 * @returns {{candidates:Array, family:string|null, saw:string[], sure:boolean}}
 */
/* Whole-plate inference. The labels that fire on a full plate are ingredients
 * ("meat loaf", "carbonara", "mashed potato"), never a dish name, so the honest
 * answer is the combination — not a shrug and a form. Evidence is compared by
 * score, not by category order: a plate whose strongest label is potato must not
 * become "pasta" because some faint label mentioned carbonara. Returns null when
 * the photo gives no basis for an answer. */
const PLATE_RE = {
  chicken: /chicken|turkey/,
  fish: /salmon|tuna|fish|shrimp|prawn|crab|lobster|trout|cod|haddock/,
  meat: /meat loaf|steak|beef|pork|ham|sausage|bacon|burger|mince|lamb/,
  pasta: /carbonara|spaghetti(?! squash)|pasta|noodle|lasagne|macaroni|fusilli|penne|linguine/,
  rice: /rice|pilaf|risotto|biryani|paella|curry/,
  potato: /potato|fries|chips|wedges|mash/,
  veg: /salad|broccoli|vegetable|greens|asparagus|beans|guacamole|avocado|cucumber|tomato/,
};

function plateGuess(predictions, fired, plated = false) {
  const best = (re) => {
    let score = 0;
    for (const p of predictions) {
      const label = norm(String(p.label || '').split(',')[0]);
      if (re.test(label)) score = Math.max(score, Number(p.score) || 0);
    }
    return score;
  };

  const protein = ['chicken', 'fish', 'meat']
    .map((k) => ({ k, s: best(PLATE_RE[k]) }))
    .sort((a, b) => b.s - a.s)[0];
  const starch = ['rice', 'pasta', 'potato']
    .map((k) => ({ k, s: best(PLATE_RE[k]) }))
    .sort((a, b) => b.s - a.s)[0];
  const vegScore = Math.max(fired.has('salad') ? 0.2 : 0, best(PLATE_RE.veg));

  const pick = (name) => FOODS.find((x) => x.name === name) || null;
  const STARCH_NAME = { rice: 'Rice (cooked)', pasta: 'Pasta (cooked)', potato: 'Potato (boiled)' };
  const PROTEIN_NAME = { chicken: 'Chicken', fish: 'Fish', meat: 'Meat' };
  const MIN = plated ? 0.02 : 0.03;

  // A bowl of vegetables is not a "meat and ..." dish, however faint the meat
  // label was. Let the strongest single food name itself instead — unless the
  // frame also carries real protein and starch evidence, which means a whole
  // dinner that the model only partly named.
  if (vegScore >= 0.1 && vegScore > protein.s && vegScore > starch.s
      && (protein.s < 0.1 || starch.s < 0.1)) return null;

  if (starch.s >= MIN && protein.s >= MIN) {
    const name = `${PROTEIN_NAME[protein.k]} and ${starch.k === 'potato' ? 'potatoes' : starch.k}`;
    return pick(name);
  }
  if (starch.s >= MIN) return pick(STARCH_NAME[starch.k]);
  if (vegScore >= MIN && protein.k === 'chicken') return pick('Chicken and vegetables');
  if (vegScore >= MIN && protein.k === 'meat') return pick('Meat and vegetables');
  return null;
}

/* Clues from drink containers, used only when no food label matched.
   MobileNet has no "soda can" class; it answers "pop bottle", "cup" or
   "coffee mug" instead, and those are deliberately ignored while real food is
   present. Alone they still say more than nothing. */
const CONTAINER_DRINKS = [
  { re: /pop bottle|soda|cola|beer can|drinking straw|can/, choices: ['Soda', 'Beer'] },
  { re: /beer bottle/, choices: ['Beer', 'Soda'] },
  { re: /water bottle|bottle|carton/, choices: ['Soda', 'Latte'] },
  { re: /coffee mug|coffee cup|cup|espresso|coffeepot/, choices: ['Coffee (black)', 'Latte'] },
];

function containerGuess(predictions) {
  for (const p of predictions) {
    const label = norm(String(p.label || '').split(',')[0]);
    if (!label) continue;
    const hit = CONTAINER_DRINKS.find((c) => c.re.test(label));
    if (!hit) continue;
    const base = Math.max(0.2, Number(p.score) || 0.3);
    return hit.choices
      .map((name, i) => ({ food: FOODS.find((f) => f.name === name), score: base * (i ? 0.72 : 1) }))
      .filter((x) => x.food);
  }
  return [];
}

export function matchVisual(predictions, learned = {}, features = null) {
  // Direct hits and shelf guesses are accumulated separately: a family guess
  // must never outrank a real label for the same photo.
  const cands = new Map();
  const put = (food, score, kind, famId = null) => {
    let c = cands.get(food.id);
    if (!c) {
      c = { food, direct: 0, fam: 0, famId: null };
      cands.set(food.id, c);
    }
    if (kind === 'direct') c.direct = Math.max(c.direct, score);
    else if (score > c.fam) { c.fam = score; c.famId = famId; }
  };

  const familyScore = new Map();
  const fired = new Map(); // family id -> Set of trigger terms that fired
  const spoken = [];
  let tableware = 0;

  for (const p of predictions) {
    const score = Math.max(0, Number(p.score) || 0);
    if (!score) continue;
    const raw = String(p.label || '');
    const label = norm(raw.split(',')[0]);
    const full = norm(raw);
    if (!label) continue;
    spoken.push(raw.split(',')[0].trim());
    if (NON_FOOD.has(label)) { tableware = Math.max(tableware, score); continue; }

    // 1. Labels that name a food in the table.
    for (const f of FOODS) {
      const names = [norm(f.name), ...f.aliases.map(norm)];
      const hit = names.find((n) => aliasMatch(label, n));
      if (!hit) continue;
      // A label that *ends* in the matched term is usually the dish itself
      // ("chocolate chip cookie" is a cookie). A label that merely contains it
      // is weaker, so "chocolate" cannot outrank "cookie" for that photo.
      const strong = label === hit || label.endsWith(' ' + hit);
      put(f, score * (strong ? 1 : 0.84), 'direct');
    }

    // 2. Generic labels expand to their shelf — but only the generic members
    //    unless the label was specific enough to name an item.
    for (const fam of VISUAL_FAMILIES) {
      const hits = fam.triggers.filter((t) => hasTerm(full, t) || hasTerm(label, t));
      if (!hits.length) continue;
      familyScore.set(fam.id, (familyScore.get(fam.id) || 0) + score);
      if (!fired.has(fam.id)) fired.set(fam.id, new Set());
      for (const h of hits) fired.get(fam.id).add(h);

      const items = fam.foods.map((entry) => {
        const [name, weight, needs] = Array.isArray(entry) ? entry : [entry, 1, null];
        const f = FOODS.find((x) => x.name === name);
        if (!f) return null;
        const justified = !needs || needs.some((n) => hits.includes(n));
        return { f, weight: weight * (justified ? 1 : 0.4) };
      }).filter(Boolean);

      // Centre the fingerprint scores inside the family: a badly exposed photo
      // then shifts every candidate equally instead of dragging the list wrong.
      const aff = items.map((it) => lookAffinity(it.f.id, features));
      const mean = aff.reduce((a, b) => a + b, 0) / (aff.length || 1);

      items.forEach((it, i) => {
        const bump = features ? nudge(1 + (aff[i] - mean) * 1.4) : 1;
        put(it.f, score * 0.78 * it.weight * bump, 'family', fam.id);
      });
    }
  }

  // Shape cues only count when the matching shelf already fired.
  for (const hint of SHAPE_HINTS) {
    if (!hint.fams.some((id) => fired.has(id))) continue;
    const f = FOODS.find((x) => x.name === hint.food);
    if (!f) continue;
    let evidence = 0;
    for (const p of predictions) {
      const label = norm(String(p.label || '').split(',')[0]);
      if (hint.terms.some((t) => hasTerm(label, t))) evidence = Math.max(evidence, Number(p.score) || 0);
    }
    if (evidence > 0) put(f, evidence * hint.mul, 'direct');
  }

  // Context that MobileNet cannot give us directly, inferred from the labels:
  //   tableware + savoury shelves  → a plated meal, not a pastry
  //   no specific sweet word       → the photo has not earned a dessert
  // A confident single-food label ("pizza" 1.00) settles it, though: a pizza in
  // a pan still has zucchini and mushroom beside it and must not be "mixed".
  const bestDirect = Math.max(0, ...[...cands.values()].map((c) => c.direct));
  const savoury = SAVOURY_FAMILIES.filter((id) => fired.has(id));
  const sweetSpecific = [...fired.keys()].some((id) => SWEET_FAMILIES.has(id)
    && [...fired.get(id)].some((t) => SPECIFIC.has(t)));
  const mixed = bestDirect < 0.45
    && (savoury.length >= 2 || (tableware >= 0.15 && savoury.length >= 1));
  const plated = tableware >= 0.12;

  const scored = [];
  for (const c of cands.values()) {
    let fam = c.fam;
    if (c.famId && SWEET_FAMILIES.has(c.famId)) {
      if (!sweetSpecific) fam *= 0.55;      // generic "dough" is not a dessert
      if (mixed) fam *= 0.35;               // a full plate is not a pastry
      else if (plated) fam *= 0.7;
    }
    const score = Math.max(c.direct, fam);
    if (score <= 0) continue;
    scored.push({ food: c.food, score, why: c.direct >= fam ? 'direct' : c.famId, famId: c.famId });
  }

  // A plated frame still gets an answer. "Several things" made the user do the
  // work this feature exists to do, so the combined dish is named instead, with
  // the individual ingredients kept as one-tap alternatives. Tableware plus a
  // low-calorie side ("broccoli" 0.54 next to "plate" 0.39) is a whole dinner
  // that the model only partly named, so it gets the combined estimate too.
  const ranked = scored.slice().sort((a, b) => b.score - a.score);
  const leadNow = ranked[0];
  const sideOnPlate = plated && leadNow && leadNow.score < 0.72 && leadNow.food.kcal < 120;
  if (mixed || sideOnPlate) {
    const plate = plateGuess(predictions, fired, plated);
    if (plate) {
      const best = Math.max(0, ...scored.map((c) => c.score));
      scored.push({ food: plate, score: Math.max(0.4, best * 1.15), why: 'plate', famId: null });
    }
  }

  // A label the user already corrected wins next time. Keyed on the exact
  // top label, so "dough" can mean cinnamon roll without touching "bagel".
  // Skipped on a mixed plate: remembering "dough → cinnamon roll" must not
  // resurrect the exact mistake this detection exists to prevent.
  const topLabel = predictions.length ? norm(String(predictions[0].label || '').split(',')[0]) : '';
  const remembered = topLabel ? learned[topLabel] : null;
  if (remembered && remembered.id && !mixed) {
    const f = FOODS.find((x) => x.id === remembered.id);
    const best = Math.max(0, ...scored.map((c) => c.score));
    if (f) {
      const existing = scored.find((c) => c.food.id === f.id);
      if (existing) existing.score = Math.max(existing.score, best * 1.2, 0.35);
      else scored.push({ food: f, score: Math.max(best * 1.2, 0.35), why: 'learned', famId: null });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  /* A can or a cup is recognised as a container, and containers are filtered
     out above so they cannot outrank real food. When nothing else matched, the
     container is still the best clue in the frame: a photo of a soda can should
     answer "Soda", not "not sure what that is". Low confidence by construction,
     so the alternatives sit right next to it. */
  if (!scored.length) {
    for (const g of containerGuess(predictions)) {
      scored.push({ food: g.food, score: g.score, why: 'container', famId: null });
    }
    scored.sort((a, b) => b.score - a.score);
  }
  const foodWords = spoken.filter((s) => !NON_FOOD.has(norm(s)));
  const saw = (foodWords.length ? foodWords : spoken).slice(0, 3);
  if (!scored.length) {
    return { candidates: [], family: null, saw, sure: false, mixed: false, plated };
  }

  const top = scored[0];
  // Name the family of the *winning* candidate, not the loudest label: a photo
  // whose top answer is bread should not be labelled "meat or fish".
  const fam = top.famId ? VISUAL_FAMILIES.find((f) => f.id === top.famId) : null;

  return {
    candidates: scored.slice(0, 6),
    family: fam ? fam.name : null,
    saw,
    sure: top.why === 'direct' && top.score >= 0.5 && !mixed,
    mixed,
    plated,
    plate: top.why === 'plate',
  };
}

/** Whole-word label/alias match — "dough" must not match "doughnut".
 *  One-directional on purpose: a longer, more specific label may contain the
 *  alias ("chocolate chip cookie" is a cookie), but a bare generic word must
 *  not name a multi-word dish ("cake" is not "coffee cake"). */
function aliasMatch(label, alias) {
  if (!label || !alias) return false;
  if (label === alias) return true;
  if (alias.indexOf(' ') === -1 && label.split(' ').includes(alias)) return true;
  return false;
}
