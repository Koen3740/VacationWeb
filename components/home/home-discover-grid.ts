export function homepageDiscoverGridClass(count: number): string {
  const largeCols = count >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  return `mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:gap-5 ${largeCols}`;
}
