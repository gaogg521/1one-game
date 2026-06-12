import type { BriefInputLocale } from "@/lib/creative-brief/detect-input-locale";
import type { NovelGenreTagId } from "@/lib/novel-genre-tags";
import type { NovelBriefPack } from "@/lib/literary-brief/novel-packs";

type PackOverlay = Partial<
  Pick<
    NovelBriefPack,
    | "label"
    | "setting"
    | "world"
    | "protagonist"
    | "characters"
    | "antagonists"
    | "coreConflict"
    | "protagonistGoal"
    | "plotBeats"
    | "keyScenes"
    | "tone"
    | "writingStyle"
    | "narrativeHints"
    | "negatives"
  >
> & {
  logline?: (ctx: { title: string; userLine: string }) => string;
};

const EN_OVERLAYS: Partial<Record<NovelGenreTagId, PackOverlay>> = {
  wuxia: {
    label: "Wuxia",
    logline: ({ title }) =>
      `"${title}": As winds rise in the jianghu, the protagonist walks a path between vendetta and honor.`,
    setting: "Semi-historical ancient jianghu; era and geography must match the title and user intent.",
    world: "Martial sects, court intrigue, and undercurrents of power interwoven.",
    protagonist: "Young swordsman or hidden lineage heir",
    characters: ["Master", "ally or love interest", "rival"],
    antagonists: ["Evil sect", "political schemer", "old blood feud"],
    coreConflict: "Personal revenge versus greater righteousness",
    protagonistGoal: "Settle scores, protect the way, or stop needless bloodshed",
    plotBeats: ["Enter the world", "Trials", "Grand duel or summit", "Retreat or new order"],
    keyScenes: ["Bamboo duel", "tavern rumors", "Huashan contest", "final battle"],
    tone: "Righteous fury with a touch of melancholy",
    writingStyle: ["Crisp action", "jianghu atmosphere", "characters with backbone"],
    narrativeHints: ["Martial arts serve character", "twists must be logical", "ending should linger"],
    negatives: ["Over-the-top xianxia flight", "game template jargon"],
  },
  xianxia: {
    label: "Xianxia",
    logline: ({ title }) =>
      `"${title}": On the path of cultivation, the protagonist seeks truth amid heavenly tribulations and human bonds.`,
    setting: "Sects, mortal kingdoms, secret realms",
    world: "Heavenly law, karma, spiritual energy, and inner demons coexist",
    protagonist: "Novice cultivator or wandering ascetic",
    coreConflict: "Immortality versus staying true to oneself",
    protagonistGoal: "Ascend or protect those who matter",
    plotBeats: ["Initiation", "Trials", "Great calamity", "Dao resolution"],
    keyScenes: ["Spirit root test", "sword trial", "heavenly tribulation", "ascension or open ending"],
    tone: "Ethereal yet lethal",
    writingStyle: ["Measured classical tone", "imagery", "natural dao"],
    narrativeHints: ["Clear cultivation stages", "human bonds support the main arc"],
    negatives: ["Game stat panels", "modern memes"],
  },
  urban: {
    label: "Urban",
    logline: ({ title }) =>
      `"${title}": In a modern metropolis, the protagonist fights back against rules and desire.`,
    setting: "Contemporary tier-one or new-tier Chinese city",
    world: "Workplace, business, and social networks",
    protagonist: "Ordinary person or hidden powerhouse",
    coreConflict: "Social mobility versus moral bottom line",
    protagonistGoal: "Career success, protect family, or uncover truth",
    plotBeats: ["Low point", "Small wins", "Showdown", "New life"],
    keyScenes: ["Humiliation and awakening", "key negotiation", "identity reveal", "victory moment"],
    tone: "Satisfying comeback with realism",
    writingStyle: ["Sharp dialogue", "credible details", "fast pace"],
    narrativeHints: ["Restrained face-slapping beats", "golden fingers must be justified"],
    negatives: ["Absurd wealth numbers", "game template jargon"],
  },
  fantasy: {
    label: "Fantasy",
    logline: ({ title }) =>
      `"${title}": In a world where power rules, the underdog enters a spiral of growth and revelation.`,
    setting: "Otherworld continent or multiverse with clear power rules",
    world: "Sects, empires, secret realms; scarce resources drive conflict",
    protagonist: "Weak starter with special constitution or fortune",
    coreConflict: "Power growth tests the heart; bigger fortune, bigger risk",
    protagonistGoal: "Break limits and uncover hidden ties to the world",
    plotBeats: ["Awakening", "First triumph", "Map expansion", "Final confrontation"],
    keyScenes: ["Fortune awakening", "rank-defying fight", "sect trial", "proof of dao"],
    tone: "Hot-blooded escalation",
    writingStyle: ["Vivid imagination", "visual combat", "brisk rhythm"],
    narrativeHints: ["Clear upgrade cadence", "pay off foreshadowing"],
    negatives: ["Power creep without cost", "setting dumps without drama"],
  },
  transmigration: {
    label: "Transmigration",
    logline: ({ title, userLine }) =>
      `"${title}": ${userLine.includes("transmigr") || userLine.includes("穿越") ? "A modern soul lands in another time and space" : "Fate shifts at a critical moment"}, and the protagonist must survive with limited leverage.`,
    setting: "Dynasty and geography must match title and user setup",
    world: "Clash of modern mindset with local power structures",
    protagonist: "Transmigrator (modern knowledge constrained by era)",
    coreConflict: "Survival versus changing history while keeping one's bottom line",
    protagonistGoal: "Stand firm in chaos and fulfill the transmigration mission",
    plotBeats: ["Arrival crisis", "Learn rules", "Core historical conflict", "Climax and aftermath"],
    keyScenes: ["Landing point", "first clash with key figures", "life-or-death choice", "era aftermath"],
    tone: "Epic scale with individual fragility",
    writingStyle: ["Limited POV", "tangible historical detail"],
    narrativeHints: ["Explain transmigration logic in 1–2 chapters", "show modern thinking's cost and gain"],
    negatives: ["Game panel narrative unless requested", "unauthorized historical defamation"],
  },
  historical: {
    label: "Historical",
    logline: ({ title }) =>
      `"${title}": In a chessboard of real and imagined history, a small figure moves great events.`,
    setting: "Must align with the dynasty and major events implied by the title",
    world: "Court, military towns, and common people intertwined",
    protagonist: "Historical or fictional viewpoint character",
    coreConflict: "Individual survival versus historical torrent",
    protagonistGoal: "Protect loved ones or shift a key turning point",
    plotBeats: ["Chaos approaches", "Drawn into events", "Decision point", "Aftermath"],
    keyScenes: ["War closes in", "court intrigue", "breakout", "settling dust"],
    tone: "Weighty, fateful",
    writingStyle: ["Grounded detail", "restrained ensemble"],
    narrativeHints: ["Big events serve characters", "avoid anachronistic moralizing"],
    negatives: ["Wild historical distortion", "game jargon"],
  },
};

const MS_OVERLAY: Partial<Record<NovelGenreTagId, PackOverlay>> = {
  wuxia: {
    label: "Wuxia",
    logline: ({ title }) =>
      `"${title}": Angin jianghu berembus; protagonis menempuh jalan di celah dendam dan keadilan.`,
    setting: "Jianghu purba separa rekaan; zaman dan geografi mesti sejajar dengan tajuk pengguna.",
    world: "Puak silat, intrik istana, dan arus kuasa yang saling berkait.",
    protagonist: "Pendekar muda atau pewaris tersembunyi",
    characters: ["Guru", "sekutu atau kekasih", "musuh bebuyutan"],
    antagonists: ["Puak jahat", "perancang kuasa", "dendam lama"],
    coreConflict: "Dendam peribadi berbanding keadilan yang lebih besar",
    protagonistGoal: "Menuntut balas, melindungi jalan, atau menghentikan pertumpahan darah",
    plotBeats: ["Memasuki jianghu", "Pengembaraan", "Pertarungan besar", "Penutup atau ketenteraman baru"],
    keyScenes: ["Duel buluh", "rumor di kedai arak", "pertandingan Huashan", "pertempuran terakhir"],
    tone: "Keberanian berapi dengan sedikit kesedihan",
    writingStyle: ["Aksi padat", "suasana jianghu", "watak berprinsip"],
    narrativeHints: ["Ilmu silat berkhidmat kepada watak", "plot twist mesti logik"],
    negatives: ["Terbang xianxia berlebihan", "istilah template permainan"],
  },
  xianxia: {
    label: "Xianxia",
    logline: ({ title }) =>
      `"${title}": Di jalan kultivasi, protagonis mencari kebenaran di celah tribulasi dan ikatan manusia.`,
    setting: "Puak, kerajaan mortal, dan alam rahsia",
    world: "Undang-undang langit, karma, tenaga rohani, dan iblis dalaman",
    protagonist: "Pengikut baru atau pengembara ascetic",
    coreConflict: "Keabadian berbanding kejujuran diri",
    protagonistGoal: "Naik taraf atau melindungi orang tersayang",
    plotBeats: ["Permulaan", "Ujian", "Malapetaka besar", "Penyelesaian Dao"],
    tone: "Ethereal tetapi mematikan",
    writingStyle: ["Nada klasik", "imej", "dao semula jadi"],
    narrativeHints: ["Tahap kultivasi jelas", "ikatan manusia menyokong plot"],
    negatives: ["Panel stat permainan", "meme moden"],
  },
  urban: {
    label: "Urban",
    logline: ({ title }) =>
      `"${title}": Di metropolis moden, protagonis melawan peraturan dan nafsu.`,
    setting: "Bandar moden kontemporari",
    world: "Tempat kerja, perniagaan, dan rangkaian sosial",
    protagonist: "Orang biasa atau kuasa tersembunyi",
    coreConflict: "Mobiliti sosial berbanding garis moral",
    protagonistGoal: "Kejayaan kerjaya, melindungi keluarga, atau membongkar kebenaran",
    plotBeats: ["Titik rendah", "Kemenangan kecil", "Konfrontasi", "Kehidupan baru"],
    tone: "Comeback memuaskan dengan realisme",
    writingStyle: ["Dialog tajam", "butiran kredibel", "rentak pantas"],
    narrativeHints: ["Face-slapping terkawal", "golden finger mesti dibenarkan"],
    negatives: ["Nombor kekayaan absurd", "istilah template permainan"],
  },
};

const TH_OVERLAY: Partial<Record<NovelGenreTagId, PackOverlay>> = {
  wuxia: {
    label: "กำลังภายใน",
    logline: ({ title }) =>
      `"${title}": ลมแห่งjianghu พัดขึ้น ตัวเอกเดินบนเส้นทางระหว่างแค้นและความยุติธรรม`,
    setting: "jianghu โบราณกึ่งสมมติ ยุคและสถานที่ต้องสอดคล้องกับชื่อเรื่อง",
    world: "สำนัก กลยุทธ์ราชสำนัก และกระแสอำนาจที่เกี่ยวพันกัน",
    protagonist: "นักดาบหนุ่มหรือทายาทที่ซ่อนตัว",
    characters: ["อาจารย์", "คู่หูหรือคนรัก", "คู่แข่ง"],
    antagonists: ["สำนักชั่ว", "ผู้วางแผนอำนาจ", "แค้นเก่า"],
    coreConflict: "แค้นส่วนตัวกับความชอบธรรมที่ยิ่งใหญ่กว่า",
    protagonistGoal: "ล้างแค้น ปกป้องหลัก และหยุดการนองเลือดที่ไม่จำเป็น",
    plotBeats: ["เข้าสู่ jianghu", "ฝึกฝน", "ศึกใหญ่", "บทสรุปหรือระเบียบใหม่"],
    keyScenes: ["ดวลในป่าไผ่", "ข่าวลือในโรงเตี๊ยม", "ประลอง Huashan", "ศึกสุดท้าย"],
    tone: "อาลัยและกล้าหาญ",
    writingStyle: ["ฉากต่อสู้กระชับ", "บรรยากาศ jianghu", "ตัวละครมีหลัก"],
    narrativeHints: ["วิชากำลังภายในสนับสนุนตัวละคร", "หักมุมต้องสมเหตุสมผล"],
    negatives: ["บิน xianxia เกินจริง", "ศัพท์ template เกม"],
  },
  xianxia: {
    label: "เซียน",
    logline: ({ title }) =>
      `"${title}": บนเส้นทางบำเพ็ญ ตัวเอกแสวงหาความจริงท่ามกลางภัยฟ้าและสายใยมนุษย์`,
    setting: "สำนัก อาณาจักรมortal และมิติลับ",
    world: "กฎฟ้า กรรม พลังจิต และปีศาจในใจ",
    protagonist: "ศิษย์ใหม่หรือผู้ทรยศ",
    coreConflict: "อมตะกับการเป็นตัวเอง",
    protagonistGoal: "ขึ้นสวรรค์หรือปกป้องคนสำคัญ",
    plotBeats: ["เริ่มต้น", "ทดสอบ", "หายนะ", "จบ Dao"],
    tone: "ลึกลับแต่ร้ายแรง",
    writingStyle: ["ภาษาคลาสสิก", "ภาพ", "ธรรมชาติ"],
    narrativeHints: ["ขั้นบำเพ็ญชัด", "สายใยมนุษย์หนุนเรื่อง"],
    negatives: ["สถิติเกม", "มีมสมัยใหม่"],
  },
  urban: {
    label: "เมือง",
    logline: ({ title }) =>
      `"${title}": ในมหานครสมัยใหม่ ตัวเอกต่อสู้กับกฎและความปรารถนา`,
    setting: "เมืองใหญ่ร่วมสมัย",
    world: "ที่ทำงาน ธุรกิจ และเครือข่ายสังคม",
    protagonist: "คนธรรมดาหรือผู้มีพลังซ่อน",
    coreConflict: "ความก้าวหน้ากับเส้นใต้ทางศีลธรรม",
    protagonistGoal: "ความสำเร็จ ปกป้องครอบครัว หรือเปิดเผยความจริง",
    plotBeats: ["จุดต่ำ", "ชนะเล็ก", "เผชิญหน้า", "ชีวิตใหม่"],
    tone: "พลิกชีวิตที่น่าพอใจแต่สมจริง",
    writingStyle: ["บทสนทนาแหลม", "รายละเอียดน่าเชื่อ", "จังหวะเร็ว"],
    narrativeHints: ["หน้าแดงพอดี", "golden finger ต้องมีเหตุผล"],
    negatives: ["ตัวเลขความร่ำรวยเกินจริง", "ศัพท์ template เกม"],
  },
};

function mergePackOverlay(pack: NovelBriefPack, overlay: PackOverlay): NovelBriefPack {
  return {
    ...pack,
    ...overlay,
    logline: overlay.logline ?? pack.logline,
    characters: overlay.characters ?? pack.characters,
    antagonists: overlay.antagonists ?? pack.antagonists,
    plotBeats: overlay.plotBeats ?? pack.plotBeats,
    keyScenes: overlay.keyScenes ?? pack.keyScenes,
    writingStyle: overlay.writingStyle ?? pack.writingStyle,
    narrativeHints: overlay.narrativeHints ?? pack.narrativeHints,
    negatives: overlay.negatives ?? pack.negatives,
  };
}

/** 非中文输入时使用对应语言的题材包骨架，避免 brief 仍全是中文。 */
export function localizeNovelBriefPack(pack: NovelBriefPack, locale: BriefInputLocale): NovelBriefPack {
  if (locale === "zh" || locale === "zh-Hant") return pack;

  if (locale === "ms") {
    const overlay = MS_OVERLAY[pack.id as NovelGenreTagId] ?? EN_OVERLAYS[pack.id as NovelGenreTagId];
    if (overlay) return mergePackOverlay(pack, overlay);
  }
  if (locale === "th") {
    const overlay = TH_OVERLAY[pack.id as NovelGenreTagId] ?? EN_OVERLAYS[pack.id as NovelGenreTagId];
    if (overlay) return mergePackOverlay(pack, overlay);
  }

  const enOverlay = EN_OVERLAYS[pack.id as NovelGenreTagId];
  if (enOverlay) return mergePackOverlay(pack, enOverlay);

  return mergePackOverlay(pack, {
    label: pack.label,
    logline: ({ title }) => `"${title}": A serialized web-novel concept built from the user's genre and title.`,
    setting: "Setting must match the user's title and stated era or world.",
    world: "World rules and social structure should feel coherent with the genre.",
    protagonist: "Named protagonist with a clear motivation",
    coreConflict: "Central dramatic tension that escalates across chapters",
    protagonistGoal: "A concrete goal the protagonist pursues to the end",
    plotBeats: ["Setup", "Escalation", "Crisis", "Resolution"],
    keyScenes: ["Inciting incident", "midpoint turn", "climax", "aftermath"],
    tone: "Match the genre's emotional register",
    writingStyle: ["Clear prose", "visual scenes", "distinct voices"],
    narrativeHints: ["Chapter hooks", "foreshadow payoffs", "complete ending for short works"],
    negatives: ["Game HUD jargon", "unauthorized IP"],
  });
}
