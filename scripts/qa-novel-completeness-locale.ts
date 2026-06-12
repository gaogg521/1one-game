import assert from "node:assert/strict";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { novelChapterHint } from "@/lib/novel-locale-prompts";
import { getNovelSystemPrompt } from "@/lib/novel-generate-config";

const englishComplete = `=== Chapter 1: Tavern Whispers ===

Rain drummed on the tiles while Shen Lian waited for the messenger. The tavern was loud with rumors of the new Jinyiwei captain, and every glance felt like a blade testing his patience. He kept his cup steady, listening for the footstep that would change the night.

=== Chapter 2: The Bamboo Trap ===

Steel flashed through the grove, and the conspiracy finally showed its hand. Ambushers closed the path behind him while lanterns swayed like hanging verdicts. Shen Lian fought through the bamboo, forcing each enemy to reveal who had paid for his death.

=== Chapter 3: One Night, One Verdict ===

Before dawn, the traitor fell, the innocent were cleared, and peace returned to the capital. The emperor's order came with sunrise, and the city breathed again. At last the case was closed, and Shen Lian sheathed his blade knowing the night had ended in justice. The markets reopened, prisoners walked free, and the capital finally breathed as one.`;

const englishCliffhanger = `=== Chapter 1: Opening ===

The guard entered the hall. Torches painted long shadows across the stone floor while ministers whispered behind silk fans. Shen Lian felt the room tighten around him like a snare drawn slow and patient.

=== Chapter 2: Trap ===

Steel rang in the dark corridor. Allies vanished into side passages, and the doors ahead sealed with iron bars. Every step forward sounded like a countdown he could not stop.

=== Chapter 3: Unfinished ===

He reached for the door, unaware that danger waited beyond. To be continued in the next chapter, when the true mastermind would finally step from the dark.`;

const japaneseComplete = `=== 第1章 雨の夜 ===

雨が瓦を打った。沈連は使者を待っていた。酒場では風の噂が飛び交い、錦衣衛の影が長く伸びていた。彼は杯を置き、扉の向こうの足音に耳を澄ました。灯りが揺れるたび、陰謀の気配が濃くなり、彼は昨夜の密命を思い出した。都の清白を守るためなら、この雨の夜に刃を抜く覚悟もあった。客人たちは笑い、歌い、誰も明日の血を想像していない。だが沈連は、笑顔の裏で交わされる手の形まで見逃さなかった。雨音はまだ止まないが、彼の心はすでに次の一手を読み始めていた。使者の足音が近づくまで、彼は微動だにしなかった。都の運命は、この数息の間に決まる。彼は杯を置き、冷たい扉へ向かった。

=== 第2章 竹林 ===

刃が光り、陰謀が姿を現した。竹林の奥で待ち伏せした者たちは一斉に動き、沈連は息を整えながら退路を探した。ここで倒れれば、すべてが水の泡になる。竹の葉を裂く風音の中、敵の主使を追い詰めるため、彼は一歩ずつ深みへ踏み込んだ。血の匂いより先に、嘘の形が現れるはずだと信じていた。月光は地面に銀の筋を引き、足跡はすぐに泥に消えた。追う者と追われる者の境界が薄れ、夜は一瞬の判断だけを残した。

=== 第3章 暁の決断 ===

夜明け前、裏切り者は倒れ、都に平穏が戻った。長い夜が終わり、人々は再び朝日の下で息をついた。冤罪は洗われ、市は開き、錦衣衛の剣は鞘に収められた。物語はここで静かに幕を下ろし、沈連は雨上がりの空を見上げて、ようやく任務の終わりを噛みしめた。朝の鐘が鳴り、都は安らぎを取り戻し、彼の名は静かに歴史の一頁へ沈んでいった。長い調べのあと、街角の子どもたちは笑い声を取り戻し、酒場の主人は暖かい粥を振る舞った。誰もがこの夜の恐怖を忘れ、新しい一日を迎える準備を始めた。沈連は最後にもう一度都を見渡し、静かに門をくぐって去っていった。風は止み、雲は裂け、石板の道は再び光を反射した。彼は振り返らず歩き続けたが、その背中には都を守った者だけが知る重さが残っていた。やがて市は完全に目を覚まし、商人は扉を開き、学童は朗読の声を上げた。誰一人として昨夜の恐怖を口にしなかったが、すべての目は安堵の色を帯びていた。`;

const malayComplete = `=== Chapter 1: Hujan ===

Hujan membasahi bumbung ketika Shen Lian menunggu utusan di tepi jalan. Desas-desus jianghu beredar, dan bayang pengawal pertama bergerak dalam gelap. Setiap cahaya lilin yang bergoyang menambah ketegangan, sementara dia mengingat titah rahsia yang membawanya ke malam ini. Demi membersihkan nama kota, dia bersedia menghunus pedang sebelum fajar. Tetamu yang tertawa tidak tahu bahawa satu isyarat tangan boleh mengubah nasib seluruh dinasti.

=== Chapter 2: Perangkap ===

Bilah bersinar di lorong gelap. Musuh yang lama mengintai akhirnya muncul, dan perangkap buluh menutup jalan keluar. Shen Lian menahan nafas, mencari celah untuk bertahan. Di celah angin yang membelah daun buluh, dia mengejar bayang dalang sebenar, yakin pengkhianatan akan mendedah wajahnya sebelum subuh. Setiap langkahnya meninggalkan jejak di lumpur, tetapi tekadnya tidak goyah sedikit pun.

=== Chapter 3: Penutup ===

Pada akhirnya, pengkhianat jatuh dan damai kembali ke ibu kota. Fajar menyingsing, dan orang ramai akhirnya bernafas lega. Kes yang mengaburkan kota sejak semalam kini selesai, dan Shen Lian mengetup pedangnya dengan tenang. Pasar dibuka semula, yang tidak bersalah dibebaskan, dan keadilan benar-benar dipulihkan sebelum matahari naik tinggi. Kanak-kanak berlari di jalan batu, pedagang membuka tingkap, dan kota kembali hidup seperti sediakala. Tiada siapa lagi bercerita tentang malam yang panjang itu, tetapi semua orang tahu siapa yang membayar harga untuk membawa damai kembali.`;

function main() {
  const enPrompt = "Write a short wuxia story in English.";
  const jaPrompt =
    "明朝の錦衣衛について日本語で短編を書いて。全編を日本語で完結させ、最終章で主筋を収束させること。";
  const msPrompt = "Tulis cerpen wuxia dalam Bahasa Melayu.";

  assert.equal(
    assessNovelCompleteness(englishComplete, "short", undefined, enPrompt).ok,
    true,
    "英文完结短篇应通过",
  );
  assert.equal(
    assessNovelCompleteness(englishCliffhanger, "short", undefined, enPrompt).ok,
    false,
    "英文悬念未完应失败",
  );
  const jaReport = assessNovelCompleteness(japaneseComplete, "short", undefined, jaPrompt);
  assert.equal(jaReport.ok, true, `日文完结短篇应通过：${jaReport.reason}（${japaneseComplete.length} 字）`);
  assert.equal(
    assessNovelCompleteness(malayComplete, "short", undefined, msPrompt).ok,
    true,
    "马来文完结短篇应通过",
  );

  const enSystem = getNovelSystemPrompt("medium", undefined, enPrompt);
  assert.match(enSystem, /3–4 chapters|5–8 chapters/i);
  assert.doesNotMatch(enSystem, /必须写完完整主线并收束结尾/);
  assert.ok(enSystem.includes(novelChapterHint("medium", "en")));

  const jaSystem = getNovelSystemPrompt("short", undefined, jaPrompt);
  assert.match(jaSystem, /3〜4 章/);
  assert.doesNotMatch(jaSystem, /3–4 章，每章 250–700 字/);
}

main();
console.log("qa-novel-completeness-locale: ok");
