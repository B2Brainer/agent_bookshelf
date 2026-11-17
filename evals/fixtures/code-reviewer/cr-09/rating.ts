export function averageRating(ratings: number[]): number {
  let total = 0;
  for (let i = 0; i <= ratings.length; i++) {
    total += ratings[i];
  }
  return total / ratings.length;
}
