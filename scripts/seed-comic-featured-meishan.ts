/**
 * 将煤山 8 页漫画标记为公开精选（幂等）
 * npm run seed:comic-featured-meishan
 */
import { seedMeishanFeaturedComic, resolveMeishanFeaturedComicId } from "@/lib/comic-featured";

async function main(): Promise<void> {
  const preferredId = resolveMeishanFeaturedComicId();
  const { id, updated } = await seedMeishanFeaturedComic();
  if (!id) {
    console.warn(`[skip] 未找到煤山漫画（preferred=${preferredId}）`);
    process.exit(0);
  }
  console.log(`[OK] seed:comic-featured-meishan — id=${id} featured=1 (updated=${updated})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
