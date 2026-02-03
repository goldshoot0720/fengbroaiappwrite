"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Search, Plus, Heart, Play, Pause, Volume2, SkipBack, SkipForward, Download, Copy } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { useMusic, MusicData } from "@/hooks/useMusic";
import { getProxiedMediaUrl } from "@/lib/utils";

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  lyrics: {
    zh: string;
    en?: string;
    ja?: string;
    yue?: string;
    ko?: string;
  };
  audioFiles: {
    zh: string;
    en?: string;
    ja?: string;
    yue?: string;
    ko?: string;
  };
  audioVariations?: {
    [key in 'zh' | 'en' | 'ja' | 'yue' | 'ko']?: Array<{
      name: string;
      url: string;
    }>
  };
  genre?: string;
  year?: number;
  isFavorite: boolean;
  originalData?: MusicData; // 保存原始 Appwrite 數據
}

// 示例歌曲數據
const SAMPLE_SONGS: Song[] = [
  {
    id: "1",
    title: "塗哥水電王子爆紅",
    artist: "鋒兄 & 塗哥",
    album: "鋒兄音樂精選",
    lyrics: {
      zh: `[故事開始]
西元兩零零四年六月十五日，這一天是國中畢業生可以在畢業紀念冊留下紀念簽名的一天，同時也是我們故事主角塗神：塗三傑――江湖人稱塗哥一切的開始。

[台中小吃店對話]
塗哥人在台中小吃店，同行（姓同名行，塗哥師傅）指著電視畫面說台北爆發學運太陽花學運，塗哥說我不懂政治，等一下我們去買太陽餅。我聽鋒兄說彰化盛產向日葵，下個月我們去彰化農場踏青，同行職業病發作對農場施工頭頭是道。

[鋒兄歷史小學堂]
鋒兄歷史小學堂林學徒說AI機器人有可能取代水電工，我好焦慮喔，塗哥說可是我聽鋒兄說那是未來不是現在，先作好手邊的工作，當一天和尚撞一天鐘。

[副市長同學]
塗哥說我有個同學在台北當副市長，同行回你是說鋒兄嗎，鋒兄？！怎麼可能，鋒兄現在是青木瓜手搖飲區域經理，副市長是黃馨鋒，同行說我還以為是鋒兄，一樣名字有個鋒字。對了你那同學不出來選台北市長嗎？塗哥說我同學寫了一本有關於水電工的書，他說銷售量超過兩百五十萬冊，才有出來選的本錢。

[動物園快閃]
有人在台北動物園快閃唱動物園不得了了，蠟筆小新？！塗哥說我不懂日語，等一下我們去KTV唱快樂天堂。

[電視劇熱潮]
塗董，最近的電視劇很火你有在看嗎，水電情？！聽說原型人物是塗偉傑，塗偉傑？！我叫塗三傑，姓名只差一個字，說不定是我遠房親戚，真的假的，你們塗家壟斷水電這一行業太誇張了吧。

[現象級成功]
塗董，你知道塗偉傑紅到被寫進高職國文課本這件事嗎，哇操，塗偉傑肯定是我遠房親戚，傻眼貓咪，我看鋒兄家的貓都會傻眼現象級水電工塗哥人物專訪。

[衍生作品帝國]
塗神衍生作品王子高職國文課本 水電電視劇 愛上水電工 主題曲鋒兄作詞 小說名場景 青木瓜四木飲冠名播出 鋒兄和塗哥喝青木瓜四木飲一年份喝到吐電影 水電工大老闆。

[學術引用]
學術引用 社會學系碩士論文引用 塗神水電王子 二十一世紀前期文學作品所呈現的台灣社會國文學系博士論文引用 塗神水電王子 台灣政治人物代表作家及其作品研究。

[財富成就]
塗哥水電王子爆紅 鋒兄賺三百三十三億 塗哥賺三億`,
      en: `[The Beginning]
On June 15, 2004, this day marks when junior high school graduates could leave commemorative signatures in their yearbook, and it was also the beginning of everything for our story's protagonist, Tu Shen: Tu Sanjie, later known as Tu Ge.

[Conversation at Taichung Snack Shop]
Tu Ge was at a small snack shop in Taichung. His companion, Tong Xing (known as Tu Ge's master, same surname and name), pointed at the TV and mentioned the outbreak of the Sunflower Movement in Taipei. Tu Ge replied, "I don't understand politics; let's go buy some sun cakes." He heard from Feng Xiong that Changhua is abundant in sunflowers, and next month they planned a day trip to a farm in Changhua. Tong's occupational habits kicked in, discoursing expertly on farm construction.

[Feng Xiong's Little History Class]
Lin, the apprentice, said AI robots might replace electricians. "I'm so anxious," Lin said. Tu Ge reassured, "But I heard Feng Xiong say that's the future, not now. First, let's focus on our work at hand: take life one step at a time."

[The Deputy Mayor Classmate]
Tu Ge mentioned having a classmate who serves as deputy mayor in Taipei. Tong replied, "Are you talking about Feng Xiong?" "Feng Xiong?! That's impossible. Feng Xiong is now the regional manager of a green papaya drink franchise. The deputy mayor is Huang Xingfeng," Tong said. "I thought it was Feng Xiong; they both have 'Feng' in their names. Anyway, is your classmate not running for mayor?" Tu Ge said, "My classmate wrote a book about electricians that sold over 2.5 million copies, so he has the capability to run for office."

[Zoo Flash Mob]
Someone did a flash mob at the Taipei Zoo, singing about the zoo's wonders. "Shin-chan?!" Tu Ge said, "I don't speak Japanese; let's head to the KTV to sing 'Paradise'."

[TV Drama Craze]
Chairman Tu, have you been watching the recent hit drama? 'The Love of an Electrician?!' I heard it's based on Tu Weijie's true story. "Tu Weijie?! My name is Tu Sanjie, just one character off; he might be my distant relative. Really? Your Tu family dominating the electrician industry is outrageous!"

[Phenomenal Success]
Chairman Tu, do you know Tu Weijie's fame reached the point of being included in vocational school literature textbooks? "Holy moly, Tu Weijie must be my distant relative. Shocked like a cat. Even Feng Xiong's cat would be shocked!"

[Derivative Works Empire]
Tu Shen's Derivative Works Prince: Vocational Literature Textbooks - Electricians, TV Drama Theme Song: 'Falling in Love with an Electrician' Lyrics by Feng Xiong. Famous scenes from the novel sponsored by Papaya Fourwood Drink, Feng Xiong and Tu Ge drank a year's supply until they were sick. Film: The Electrician Tycoon.

[Academic Citation]
Academic Citation: Sociology Master's Thesis Citing "Tu Shen Electrician Prince" - Early 21st Century Literary Presentation of Taiwanese Society. Chinese Literature Ph.D. Dissertation Citing "Tu Shen Electrician Prince" - A Study of Representative Taiwanese Political Figures and Their Works.

[Financial Achievement]
Tu Ge's Phenomenal Rise: Feng Xiong made three hundred and thirty-three billion, Tu Ge made three billion`,
      ja: `2004年6月15日、この日は中学校の卒業生が年鑑に記念のサインを残せる日であり、物語の主人公、塗神こと塗三杰（後に塗哥として知られる）の全ての始まりでした。塗哥は台中の小さなスナックショップにいました。彼の仲間である通行（塗哥の師匠。同じ姓と名）はテレビを指差し、台北でのひまわり運動の勃発について言及しました。塗哥は「政治のことはよくわからない。菓子を買いに行こう」と答えました。彼は馮兄から、彰化にはひまわりがたくさんあると聞き、来月に彰化の農場への日帰り旅行を計画していました。通の職業習慣が作動し、農場建設について専門的に話し合いました。馮兄の小さな歴史クラスリンの弟子は、「ロボットが電気工を置き換えるかもしれない」と言いました。「とても不安だ」とリンは言いました。塗哥は「でも、馮兄によれば、それは未来のことだ、今ではない。まずは手元の仕事に集中しよう。一歩ずつ生きていこう」と安心させました。塗哥は彼の同級生が台北の副市長を務めていると述べました。通は、「馮兄のことを話しているの？」と答えました。「馮兄？！それはありえない。馮兄は今、青パパイヤドリンクフランチャイズの地域担当マネージャーだ。副市長は黄興豊だ」と通は言いました。「馮兄だと思ったけど、彼らはどちらも『豐』が名前にあるんだ。いずれにせよ、あなたの同級生は市長選に出馬しないのか？」塗哥は、「私の同級生は電気工についての本を書いて、250万部以上売れたから、政治家になる能力も持っています」と言いました。誰かが台北動物園でフラッシュモブをして、動物園の素晴らしさを歌いました。「しんちゃん？！」塗哥は、「日本語は話せない。KTVに行って『パラダイス』を歌いに行こう」と言いました。塗会長、最近のヒットドラマをご覧になりましたか？『電気工の愛』ですか？！それは塗偉傑の真実を基にしています。「塗偉傑？！私の名前は塗三杰、あと一文字しかない。彼は私の遠い親戚かも。ほんとに？あなたの塗家が電気工業界を支配しているのはとんでもないことだ！」塗会長、塗偉傑の名声が職業学校の文学の教科書に載るほどになったことをご存知ですか？「おお、塗偉傑は私の親戚かもしれない。猫をびっくりさせるような衝撃。馮兄の猫もびっくり！」電気工塗哥の驚異的なインタビュー塗神の派生作品プリンス職業文学教科書 - 電気工テレビドラマ主題歌：『電気工に恋して』 作詞：馮兄。有名なシーンはパパイヤ・フォーウッド・ドリンクの協賛で、馮兄と塗哥は1年間の供給を飲んで病気になりました。映画：電気工大君学術引用:「塗神電気工プリンス」を引用した社会学修士論文 - 21世紀初頭の台湾社会文学のプレゼンテーション中国文学の博士論文は「塗神電気工プリンス」を引用しています - 台湾の代表的な政治人物とその作品の研究塗哥の驚異的な躍進：馮兄は三千三百三十三億を稼ぎ、塗哥は三億を稼ぎました。`,
      yue: `2004年6月15日，呢日係中學畢業生喺年鑑度留紀念簽名嘅日子，都係故仔個主角，塗神即係塗三杰（之後畀人叫塗哥）嘅一切開始。塗哥喺台中一間細細嘅零食店入面。佢嘅朋友通行（塗哥嘅師傅。同姓同名）指住電視，提到台北嘅太陽花運動爆發。塗哥話：「政治我唔係好識。不如買零食去啦。」佢從馮兄度聽到彰化有好多向日葵，計劃下個月去彰化個農場一日遊。通職業病發作，專業咁同佢傾農場建設。馮兄嘅細歷史堂阿麟嘅徒弟話：「可能啲機械人會取代電工。」阿麟話：「真係好擔心。」塗哥就話：「不過，馮兄話，呢啲係未來果陣嘅事，宜家仲未到。好似佢講咁，專心做宜家嘅嘢，慢慢一步一腳印咁過日子。」塗哥提起佢嘅同學做緊台北嘅副市長。通問：「你講緊馮兄咩？」通話：「馮兄？！冇可能。馮兄而家係青木瓜汁加盟店嘅區域經理。副市長係黃興豐。」塗哥話：「我以為係馮兄，但佢哋個名都有『豐』。不過，你個同學會唔會選市長？」塗哥話：「我個同學寫咗本關於電工嘅書，賣咗過250萬本，所以佢其實都可以做個政客。」有人喺台北動物園做咗個快閃，唱咗首讚美動物園嘅歌。「新仔？！」塗哥話：「我唔識講日文。不如去KTV唱《天堂》啦。」塗會長，最近你有冇睇過嗰齣人氣戲劇呀？就係《電工之愛》！呢齣戲係根據塗偉杰嘅故事改編。「塗偉杰？！我叫塗三杰啫，淨多個字，可能真係遠親喇。真係嗎？你哋塗家喺電工業界咁巴閉真係好夠晒威呀！」塗會長，你知唔知塗偉杰嘅名氣已經去到職業學校嘅文學課本入面呢？「哦，如果塗偉杰真係我親戚，咁咪真係夠晒轟動，連馮兄嘅貓都會嚇親！」塗電工嘅驚人訪問塗神嘅延伸作品王子職業文學課本：電工電視劇主題曲：《愛上電工》填詞：馮兄。有名嘅場景就係綠木瓜汁贊助，馮兄同塗哥飲到供應一年，飲到唔舒服。電影：電工大君學術引用：「塗神電工王子」出現喺社會學碩士論文入面 - 21世紀初台灣社會文學嘅呈現中國文學博士論文都有引述「塗神電工王子」 - 研究台灣嘅代表人物同佢哋嘅作品塗哥驚人嘅騰飛：馮兄賺咗三千三百三十三億，而塗哥賺咗三億。`,
      ko: `[스토리 시작]
서기 2004년 6월 15일, 이날은 중학교 졸업생들이 졸업기념책에 사인을 남길 수 있는 날이자, 이야기 주인공 투신: 투삼걸―江湖 사람들은 그를 ‘투哥’라 부르는 그의 모든 것이 시작되는 날이었다.

[타이중 분식점 대화]
투哥는 타이중 분식점에 있었고, 동행(성은 같지만 다른 사람, 투哥 스승)이 TV 화면을 가리키며 “타이베이에서 학생 운동, 해바라기 운동이 터졌어”라고 말했다. 투哥: “나 정치 잘 몰라, 잠시 후 우리 해바라기빵 사러 가자.” 나는 풍형에게 들었다. “장화는 해바라기 생산이 많대. 다음 달에 장화 농장으로 소풍 가자.” 동행: 직업병 발동, 농장 공사 경험 풍부.

[풍형 역사 소학당]
풍형 역사 소학당, 임습생이 말하길 “AI 로봇이 전기·배관 일을 대신할 수도 있어요, 너무 불안해요.” 투哥: “하지만 풍형이 말했잖아, 그건 미래지금은 아니야. 지금 손에 있는 일이나 잘 하자, 하루를 스님처럼 충실히 살아라.”

[부시장 동창]
투哥: “내 친구 한 명이 타이베이 부시장이야.” 동행: “풍형 말하는 거야?” 투哥: “아니, 풍형은 지금 청목과 손음료 지역 매니저야. 부시장은 황쉰펑.” 동행: “나는 풍형인 줄 알았어, 이름에 ‘펑’ 글자가 같네. 너 친구, 타이베이 시장 선거 안 나가?” 투哥: “내 친구, 전기·배관 관련 책 한 권 썼어. 250만 부 넘게 팔렸어. 그럼 선거 나갈 수 있는 자본이 생기지.”

[동물원 플래시몹]
타이베이 동물원에서 누군가 플래시몹으로 노래를 불렀다. 투哥: “나는 일본어 몰라, 잠시 후 우리 KTV 가서 ‘행복천국’ 노래 부르자.”

[드라마 열풍]
투동: “최근 드라마 인기 많아요, 보고 있어요? ‘전기·배관 러브’?” 투삼걸: “원형 인물이 투위제라고? 나는 투삼걸인데, 이름 한 글자 차이네. 혹시 먼 친척일지도, 진짜야?” “너희 투 가문이 전기·배관 산업 장악 너무 심하다.”

[현상급 성공]
투동: “투위제가 고등직업학교 국문 교과서에 실렸다는 거 알아?” 투삼걸: “와, 투위제는 분명 먼 친척일 거야. 깜짝 놀랐네. 풍형 집 고양이도 깜짝 놀라는 현상급 전기·배관 왕 투哥 인물 인터뷰.”

[파생 작품 제국]
투신 파생 작품: 왕자 고등직업학교 국문 교과서 전기·배관 드라마 ‘전기공 사랑에 빠지다’ 주제가 풍형 작사 소설 명장면 청목과 사목 음료 후원 풍형과 투哥 1년치 음료 마셔서 토할 정도 영화 전기·배관 업계 큰손

[학술 인용]
학술 인용 사회학 석사 논문 인용: ‘투신 전기왕자’ 21세기 전기 문학 작품에서 나타난 대만 사회 국문학 박사 논문 인용: ‘투신 전기왕자, 대만 정치인 대표 작가 및 작품 연구’

[재산과 성취]
투哥 전기왕자 폭발적 인기, 풍형 3,330억 원 벌다, 투哥 3억 원 벌다.`
    },
    audioFiles: {
      zh: "/musics/塗哥水電王子爆紅.mp3",
      en: "/musics/塗哥水電王子爆紅(英語).mp3",
      ja: "/musics/塗哥水電王子爆紅(日語).mp3",
      yue: "/musics/塗哥水電王子爆紅(粵語).mp3",
      ko: "/musics/塗哥水電王子爆紅(韓語).mp3"
    },
    audioVariations: {
      zh: [
        { name: "原始音樂", url: "/musics/塗哥水電王子爆紅.mp3" },
        { name: "Donald Trump", url: "/musics/塗哥水電王子爆紅(Donald Trump).mp3" },
        { name: "Pekora", url: "/musics/塗哥水電王子爆紅(Pekora).mp3" },
        { name: "SpongeBob SquarePants", url: "/musics/塗哥水電王子爆紅(SpongeBob SquarePants).mp3" },
        { name: "Hatsune Miku", url: "/musics/塗哥水電王子爆紅(Hatsune Miku).mp3" },
        { name: "Sidhu", url: "/musics/塗哥水電王子爆紅(Sidhu).mp3" },
        { name: "Rose", url: "/musics/塗哥水電王子爆紅(Rose).mp3" },
        { name: "Freddie Mercury", url: "/musics/塗哥水電王子爆紅(Freddie Mercury).mp3" }
      ]
    },
    genre: "台灣民謠",
    year: 2024,
    isFavorite: true,
  },
  {
    id: "2",
    title: "史上最瞎結婚理由",
    artist: "鋒兄 & 塗哥",
    album: "鋒兄音樂精選",
    lyrics: {
      zh: `[Intro]
鋒兄啊你說真的還假的
塗哥聽了都快笑翻了

[Verse 1]
鋒兄說要結婚理由只有一個
今彩五三九開獎那天
頭獎號碼是思敏給的
看著獎金直直落心也跟著被收編

[Chorus]
史上最瞎結婚理由
今彩五三九牽紅線牽這麼兇
一個思敏一個蕙瑄
號碼一簽兩人都中頭獎圈

[Bridge]
愛情是運氣還是數學題
笑到哭都只能說一句
最瞎最瞎但又有點甜蜜

[Outro]
鋒兄牽著思敏塗哥牽著蕙瑄
喝喜酒的人一桌一桌還在笑這兩段緣
最瞎結婚理由結果都開成頭獎
如果幸福也能這樣瞎忙
那我明天也去買一張`,
      en: `[Intro]
Brother Feng, are you serious or joking?
Brother Tu is laughing so hard

[Verse 1]
Brother Feng says there's only one reason to marry
On the day of the lottery draw
The winning numbers were given by Simin
Watching the jackpot fall, his heart was captured too

[Chorus]
The most ridiculous reason to marry
The lottery brought them together so strong
One Simin, one Huixuan
Both won the jackpot with their numbers

[Outro]
Brother Feng with Simin, Brother Tu with Huixuan
Wedding guests laughing at these two stories
Most ridiculous marriage reasons turned into jackpots
If happiness can be this absurd
Then I'll buy a ticket tomorrow too`,
      ja: `[Intro]
鋒兄、マジで？ウソでしょ？
塗哥は聞いてて笑いが止まらないよ

[Verse 1]
鋒兄は言う、結婚理由は一つだけ
今彩539の抽選日
一等番号は思敏がくれた
賞金を見て、心まで奪われて

[Chorus]
史上最も馬鹿げた結婚理由
今彩539が結んだ赤い糸がこんなに強い
一人は思敏、一人は蕙瑄
番号一つで二人とも一等当選

[Outro]
鋒兄は思敏を連れ、塗哥は蕙瑄を連れ
披露宴の客たちはテーブルごとにこの二つの縁で笑ってる
最も馬鹿げた結婚理由が一等賞に
もし幸福がこんなに馬鹿げていたら
私も明日買いに行こうかな`,
      yue: `[Intro]
阿鋒你講真定假
阿塗聽咗都快笑死

[Verse 1]
阿鋒話結婚理由得一個
今期五三九攪珠嗰日
頭獎號碼係思敏畀嘅
睇住獎金跌落心都一齊俾收編

[Chorus]
史上最瞎結婚理由
今期五三九紅線牽得幾狠
一個思敏一個蕙瑄
號碼一簽兩個都中頭獎圈

[Outro]
阿鋒拉住思敏阿塗拉住蕙瑄
飲喜酒嘅人一桌一桌
仲係笑緊呢兩段緣
最瞎結婚理由結果都開成頭獎
如果幸福都可以咁瞎忙
咁我聽日都去買一張`,
      ko: `[Intro]
펑형아, 너 진짜야? 아니야?
투형 듣고 거의 웃음 터질 뻔했어

[Verse 1]
펑형이 결혼하겠다는 이유는 딱 하나
오늘의 539 복권 당첨일
1등 번호는 시민이 준 거야
상금을 보며 마음도 함께 편입됐네

[Chorus]
역대 최웃긴 결혼 이유
오늘의 539가 이렇게 빨리 인연을 이어줘
하나는 시민, 하나는 휘현
번호 하나로 두 사람 모두 1등 당첨

[Bridge]
사랑은 운일까, 아니면 수학 문제일까
웃다가 울어도 한마디밖에 못 해
가장 웃기지만, 조금 달콤해

[Outro]
펑형은 시민과, 투형은 휘현과
축하주 마시는 사람들 테이블마다 아직도 웃어
최웃긴 결혼 이유, 결국 모두 1등 당첨
행복도 이렇게 바쁘게 올 수 있다면
그럼 나도 내일 한 장 사야겠다`
    },
    audioFiles: {
      zh: "/musics/最瞎結婚理由.mp3",
      en: "/musics/最瞎結婚理由 (英語).mp3",
      ja: "/musics/最瞎結婚理由 (日語).mp3",
      yue: "/musics/最瞎結婚理由 (粵語).mp3",
      ko: "/musics/最瞎結婚理由 (韓語).mp3"
    },
    audioVariations: {
      zh: [
        { name: "原始音樂", url: "/musics/最瞎結婚理由.mp3" },
        { name: "Donald Trump", url: "/musics/最瞎結婚理由(Donald Trump).mp3" },
        { name: "Pekora", url: "/musics/最瞎結婚理由(Pekora).mp3" },
        { name: "SpongeBob SquarePants", url: "/musics/最瞎結婚理由(SpongeBob SquarePants).mp3" },
        { name: "Hatsune Miku", url: "/musics/最瞎結婚理由(Hatsune Miku).mp3" },
        { name: "Sidhu", url: "/musics/最瞎結婚理由(Sidhu).mp3" },
        { name: "Rose", url: "/musics/最瞎結婚理由(Rose).mp3" },
        { name: "Freddie Mercury", url: "/musics/最瞎結婚理由(Freddie Mercury).mp3" }
      ]
    },
    genre: "搞笑說唱",
    year: 2024,
    isFavorite: true,
  },
  {
    id: "3",
    title: "鋒兄進化Show🔥",
    artist: "鋒兄 feat. 塗哥",
    album: "鋒兄音樂精選",
    lyrics: {
      zh: `[Hook]
台北有鋒兄真好！
嗨起來別逃跑！
從榜首進化到市長, 這節奏太離譜（wow）
塗哥唱歌別裝低調, 記者都在拍照！

[Verse 1]
37歲那年我高考三級奪榜首（yeah）
資訊處理一戰成名　程式都寫成傳說～
52歲副市長代理市長上陣忙！（yo）

[Chorus]
台北有鋒兄真好！
嗨起來別逃跑！
從榜首進化到市長, 命運像 debug 一樣爆！
塗哥嗓門開到爆表, 全場跟著大合唱！

[Verse 2]
2040那年的夜　霓虹閃爍到市政廳
競選標語像 ACG 的 opening
「別說不可能, 鋒兄就是 evolution！」

[Final Chorus]
台北有鋒兄真好！
嗨起來直到早朝！
榜首到市長的進化論　全城都在尖叫！
這是鋒兄進化 Show！🔥`,
      en: `Taipei is great with Brother Feng!
Get hyped, don't run away!
From top scorer to mayor, this rhythm is insane (wow)
Brother Tu singing, don't be shy, reporters are taking photos!

At 37, I topped the civil service exam (yeah)
Information processing made me legendary, code became legend~
At 52, deputy mayor, acting mayor, so busy! (yo)

Taipei is great with Brother Feng!
Get hyped, don't run away!
From top scorer to mayor, destiny explodes like debugging!
Brother Tu's voice at max, everyone singing along!

In 2040's night, neon lights flash at city hall
Campaign slogans like ACG opening
"Don't say impossible, Brother Feng is evolution!"

Taipei is great with Brother Feng!
Get hyped until dawn!
Evolution from top scorer to mayor, the whole city screaming!
This is Brother Feng Evolution Show! 🔥`,
      ja: `台北に鋒兄がいて本当に良い！
盛り上がって逃げるな！
トップから市長への進化、このリズムはヤバい（wow）
塗哥は歌って控えめにするな、記者が写真を撮ってる！

37歳の年に公務員試験でトップ（yeah）
情報処理で一戦成名　プログラムは伝説になった～
52歳で副市長、代理市長で忙しい！（yo）

台北に鋒兄がいて本当に良い！
盛り上がって逃げるな！
トップから市長への進化、運命はデバッグのように爆発！
塗哥の声は最大、全員が大合唱！

2040年の夜　ネオンが市政庁に輝く
選挙スローガンはACGのオープニングのよう
「不可能と言うな、鋒兄は進化だ！」

台北に鋒兄がいて本当に良い！
朝まで盛り上がれ！
トップから市長への進化論　全市が叫んでる！
これは鋒兄進化Show！🔥`,
      yue: `台北有鋒兄真好！嗨起嚟唔好逃跑！
從榜首進化到市長, 呢個節奏太誇張（wow）
塗哥唱歌唔好扮低調, 記者都係影相！
綾小路都話呢段人生 根本 S 級動畫稿～

37歲嗰年我高考三級奪榜首（yeah）
資訊處理一戰成名 程式都寫成傳說～
隔住時代嘅螢幕光 夢想好似演算法（run）
52歲副市長代理市長忙住上陣！（yo）

塗哥敢唱「有鋒兄真好」備取瞬間正取秒秒到～
唔唱就取消資格笑　進化唔靠運氣靠信號！

台北有鋒兄真好！嗨起嚟唔好逃跑！
從榜首進化到市長, 命運好似 debug 爆！
塗哥嗓門開到爆表, 全場跟住大合唱！
「代理」只係過場 市民心中早就想！

2040嗰年的夜 霓虹閃爍到市政廳
競選口號似 ACG 嘅 opening
「唔好話唔可能, 鋒兄就係 evolution！」

AI 輔助政務操作 資料開放新世代～
陰陽同框 政治與理想 交錯嘅舞台線上～
一首歌唱到選票都彈起身 塗哥仲要再唱！

台北有鋒兄真好！嗨起嚟直到朝早！
榜首到市長嘅進化論 全城都尖叫！
綾小路清隆都點頭 呢進化合乎理想！
「ムリムリ進化論？」唔——呢係鋒兄進化 Show！🔥`,
      ko: `[Hook]
타이베이에 펑형이 있어서 정말 좋아!
신나게 즐겨, 도망가지 마!
수석에서 시장까지, 이 리듬은 미쳤어 (wow)
투형 노래할 때 겸손하지 마, 기자들이 사진 찍고 있어!
아야코지는 이 인생의 장면이 S급 애니 대본 같다고 해~

[Verse 1]
37살 때 나는 고등고시 3급에서 1등을 차지했어 (yeah)
정보 처리 한판으로 이름 날리고, 코드가 전설이 되었어~
시대의 화면 빛을 통해, 꿈은 알고리즘처럼 달려 (run)
52살, 부시장 대리시장으로 바쁘게 활동 중! (yo)

[Chorus]
투형이 감히 “펑형이 있어서 좋아”라고 노래해
예비가 바로 본선, 매 순간 중요~
안 부르면 자격 박탈, 웃음
진화는 운이 아니라 신호에 달려 있어!

[Hook]
타이베이에 펑형이 있어서 정말 좋아!
신나게 즐겨, 도망가지 마!
수석에서 시장까지, 운명은 디버그처럼 폭발!
투형 목소리 폭발, 관중 다 같이 합창!
“대리”는 잠시일 뿐, 시민 마음속은 이미 알고 있어!

[Verse 2]
2040년 밤, 네온이 시청까지 빛나
선거 슬로건은 ACG 오프닝 같아
“불가능하다고 말하지 마, 펑형은 진화야!”
AI로 보조하는 행정, 데이터 공개 새 시대~

[Final Chorus]
음양 동시 등장, 정치와 이상, 무대에서 교차~
한 곡으로 투표까지 뛰게 하고, 투형은 또 노래해!

[Hook]
타이베이에 펑형이 있어서 정말 좋아!
아침까지 신나!
수석에서 시장까지 진화론, 도시 전체가 환호!
아야코지도 고개 끄덕, 이 진화는 이상에 부합해!
“불가능 진화론?” 아니야—이건 펑형 진화 쇼! 🔥`
    },
    audioFiles: {
      zh: "/musics/鋒兄進化Show🔥.mp3",
      en: "/musics/鋒兄進化Show🔥(英語).mp3",
      ja: "/musics/鋒兄進化Show🔥(日語).mp3",
      yue: "/musics/鋒兄進化Show🔥(粵語).mp3",
      ko: "/musics/鋒兄進化Show🔥(韓文).mp3"
    },
    audioVariations: {
      zh: [
        { name: "原始音樂", url: "/musics/鋒兄進化Show🔥.mp3" },
        { name: "Donald Trump", url: "/musics/鋒兄進化Show🔥(Donald Trump).mp3" },
        { name: "Pekora", url: "/musics/鋒兄進化Show🔥(Pekora).mp3" },
        { name: "SpongeBob SquarePants", url: "/musics/鋒兄進化Show🔥(SpongeBob SquarePants).mp3" },
        { name: "Hatsune Miku", url: "/musics/鋒兄進化Show🔥(Hatsune Miku).mp3" },
        { name: "Sidhu", url: "/musics/鋒兄進化Show🔥(Sidhu).mp3" },
        { name: "Rose", url: "/musics/鋒兄進化Show🔥(Rose).mp3" },
        { name: "Freddie Mercury", url: "/musics/鋒兄進化Show🔥(Freddie Mercury).mp3" }
      ]
    },
    genre: "嘻哈說唱",
    year: 2024,
    isFavorite: true,
  },
  {
    id: "4",
    title: "鋒兄進化 Show！🔥進行曲",
    artist: "鋒兄 feat. 塗哥",
    album: "鋒兄音樂精選",
    lyrics: {
      zh: `台北有鋒兄真好！　嗨起來別逃跑！
從榜首進化到市長, 這節奏太離譜（wow）
塗哥唱歌別裝低調, 記者都在拍照！
綾小路都說這段人生　根本 S 級動畫稿～

三十七歲那年我高考三級奪榜首（yeah）
資訊處理一戰成名　程式都寫成傳說～
隔著時代的螢幕光　夢想像演算法（run）
五十二歲副市長代理市長上陣忙！（yo）

塗哥敢唱「有鋒兄真好」備取瞬間正取秒秒到～
不唱就取消資格笑　進化不靠運氣靠信號！

台北有鋒兄真好！　嗨起來別逃跑！
從榜首進化到市長, 命運像 debug 一樣爆！
塗哥嗓門開到爆表, 全場跟著大合唱！
「代理」只是過場　市民心中早就想！

二零四零 那年的夜　霓虹閃爍到市政府
競選標語像 ACG 的 opening
「別說不可能, 鋒兄就是 evolution！」

AI 輔助政務操作　資料開放新世代～
陰陽同框　政治與理想　交錯的舞台線上～
一首歌唱到選票都跳起來　塗哥還要再唱！

台北有鋒兄真好！　嗨起來直到早朝！
榜首到市長的進化論　全城都在尖叫！
綾小路清隆也點頭　這進化合乎理想！
「ムリムリ進化論？」不——這是鋒兄進化 Show！🔥`,
      en: `Having Feng in Taipei is great! Get hyped, don't run away!
Evolving from top of the charts to mayor, this rhythm is outrageous (wow)
Brother Tu, don't pretend to be low-key, the reporters are taking photos!
Even Aya Kouji said this phase of life is like an S-tier anime script~

When I was thirty-seven, I topped the college exam (yeah)
Became famous in information processing, programming became legendary~
Across the screen of times, dreams run like algorithms (run)
Fifty-two years old, vice-mayor acting as a busy mayor! (yo)

Brother Tu dares to sing "Having Feng in Taipei is great"
Being a backup to securing the position, instantly!
Not singing spells disqualification laughs, evolution relies on signals, not luck!

Having Feng in Taipei is great! Get hyped, don't run away!
Evolving from top of the charts to mayor, fate explodes like a debug!
Brother Tu's voice breaks the scale, the whole audience sings along!
"Acting" is just a transition, something the citizens have long desired!

In the year 2040, on that night, neon shines on the city hall
Campaign slogans like an ACG opening
"Don't say impossible, Feng is evolution!"

AI-assisted political operations, data openness, a new era~
Yin and yang in the same frame, politics and ideals intertwining on a stage~
A song that makes the ballots jump, Brother Tu wants to sing again!

Having Feng in Taipei is great! Get hyped until morning comes!
The evolution theory from top to mayor, the entire city is screaming!
Aya Kouji also nods, this evolution matches the ideal!
"Impossible evolution theory?" No—this is Feng's Evolution Show! 🔥`,
      ja: `台北に鋒兄がいるのは本当にいい！　ハイテンションで逃げるな！
トップから市長への進化、このリズムは信じられない（wow）
塗哥が歌うとき、控えめにしないで、記者が写真を撮っている！
綾小路もこの人生をS級アニメの絵コンテと言っている～

37歳の時、大試験の三級でトップを奪った（yeah）
情報処理で一気に名声を得て、プログラムは伝説になった～
時代を隔てたスクリーンの光、夢はアルゴリズムのように（走る）
52歳で副市長、代理市長として忙しく舞台に上がる！（yo）

塗哥が「鋒兄がいるのは本当にいい」と歌う勇気がある
予備からすぐに正規になり、各秒で到達！
歌わないと資格を失う笑い、進化は運に頼らず信号に頼る！

台北に鋒兄がいるのは本当にいい！　ハイテンションで逃げるな！
トップから市長への進化、運命はデバッグのように爆発する！
塗哥の声が爆音に達し、全場が大合唱に加わる！
「代理」は単なる通過点、市民の心には既に想いがある！

2040年のその夜、ネオンが市庁舎に輝く
選挙スローガンがACGのオープニングのように
「無理だと言わないで、鋒兄がエボリューションだよ！」

AIが政務の操作を支援、データ解放の新時代～
陰と陽が交錯し、政治と理想が舞台上で交錯～
一曲で選票が跳ね上がり、塗哥はまだ歌い続ける！

台北に鋒兄がいるのは本当にいい！　朝までハイテンション！
トップから市長への進化論、全市が叫び声を上げている！
綾小路清隆も頷き、この進化は理想に合っている！
「無理無理進化論？」いや、これは鋒兄進化ショーだ！🔥`,
      yue: `台北有鋒兄真好！　嘿起身唔好走！
從榜首進化到市長, 這節奏太誇張（wow）
塗哥唱歌唔好扮低調, 記者都喺度影相！
綾小路都話呢段人生　根本 S 級動畫稿～

三十七歲嗰年我高考三級攞榜首（yeah）
資訊處理一戰成名　程式都寫成傳說～
隔住時代嘅螢幕光　夢想好似演算法（run）
五十二歲副市長代市長上陣忙！（yo）

塗哥敢唱「有鋒兄真好」備取瞬間正取秒秒到～
唔唱就取消資格笑　進化唔靠運氣靠信號！

台北有鋒兄真好！　嘿起身唔好走！
從榜首進化到市長, 命運好似 debug 咁爆！
塗哥嗓門開到爆表, 全場跟住大合唱！
「代理」只係過場　市民心中早就諗！

二零四零 嗰年的夜　霓虹閃爍到市政府
競選標語好似 ACG 嘅 opening
「唔好話唔可能, 鋒兄就係 evolution！」

AI 輔助政務操作　資料開放新世代～
陰陽同框　政治與理想　交錯的舞台線上～
一首歌唱到選票都跳起來　塗哥仲要再唱！

台北有鋒兄真好！　嘿起身直到早朝！
榜首到市長的進化論　全城都喺尖叫！
綾小路清隆都點頭　呢進化合乎理想！
「ムリムリ進化論？」唔——呢係鋒兄進化 Show！🔥`,
      ko: `타이베이에 펑형님이 있어서 좋다! 신나게 흔들어 봐요, 도망가지 말고!
정상에서 시장으로 진화하다니, 이 리듬이 너무 말도 안 돼 (wow)
박가 노래할 때 눈치 보지말고, 기자들은 다 사진 찍고!
아야나코지도 인생의 이 순간은 애니메이션의 S급 시나리오 같다네요 ~

서른일곱 살 때 난 3급 고시에 합격 (yeah)
정보 처리로 단번에 명성을 얻어, 프로그램이 전설처럼 쓰여졌죠 ~
시대를 넘는 화면의 불빛 사이로, 꿈은 알고리즘처럼 달린다 (run)
오십이세 부시장이 시장 대리로 바쁘게 나섭니다! (yo)

박가는 "펑형님이 있어서 좋다"라고 노래한다
순위 대기자가 즉시 합격자로 올라온다
노래하지 않으면 자격이 취소되어 웃음, 진화는 운이 아니라 신호에 의존해요!

타이베이에 펑형님이 있어서 좋다! 신나게 흔들어 봐요, 도망가지 말고!
정상에서 시장으로 진화하다니, 운명은 디버그처럼 터져요!
박가의 성량이 터지도록 올리고, 온 관중이 대합창을 해요!
"대리"는 단지 통과일 뿐, 시민의 마음 속에는 이미 생각하고 있어요!

이천사십년 그 해의 밤, 네온이 시청까지 반짝이고
선거 구호는 ACG의 오프닝 같다
"불가능은 말하지 말고, 펑형님이 바로 진화다!"

AI 보조 행정 조작, 데이터 개방의 새로운 시대
음양이 같은 자리에 있고, 정치와 이상이 교차하는 무대의 선상
한 곡을 불러 투표가 뛰어오를 때, 박가는 또 노래하고 싶어요!

타이베이에 펑형님이 있어서 좋다! 아침까지 신나게 흔들어 봐요!
정상에서 시장으로의 진화론, 도시 전체가 소리 지르고 있어요!
아야나코지 쿄타카도 고개를 끄덕인다 이 진화는 이상과 맞다고!
"불가능한 진화론?" 아니–이것이 펑형님 진화 쇼입니다!🔥`
    },
    audioFiles: {
      zh: "/musics/鋒兄進化 Show！🔥進行曲.mp3",
      en: "/musics/鋒兄進化 Show！🔥進行曲(英語).mp3",
      ja: "/musics/鋒兄進化 Show！🔥進行曲(日語).mp3",
      yue: "/musics/鋒兄進化 Show！🔥進行曲(粵語).mp3",
      ko: "/musics/鋒兄進化 Show！🔥進行曲(韓語).mp3"
    },
    audioVariations: {
      zh: [
        { name: "原始音樂", url: "/musics/鋒兄進化 Show！🔥進行曲.mp3" },
        { name: "Donald Trump", url: "/musics/鋒兄進化 Show！🔥進行曲 (Donald Trump).mp3" },
        { name: "Pekora", url: "/musics/鋒兄進化 Show！🔥進行曲 (Pekora).mp3" },
        { name: "SpongeBob SquarePants", url: "/musics/鋒兄進化 Show！🔥進行曲(SpongeBob SquarePants).mp3" },
        { name: "Hatsune Miku", url: "/musics/鋒兄進化 Show！🔥進行曲 (Hatsune Miku).mp3" },
        { name: "Sidhu", url: "/musics/鋒兄進化 Show！🔥進行曲 (Sidhu).mp3" },
        { name: "Rose", url: "/musics/鋒兄進化 Show！🔥進行曲 (Rose).mp3" },
        { name: "Freddie Mercury", url: "/musics/鋒兄進化 Show！🔥進行曲 (Freddie Mercury).mp3" }
      ]
    },
    genre: "進行曲/嘻哈",
    year: 2024,
    isFavorite: true,
  },
  {
    id: "5",
    title: "鋒兄的傳奇人生",
    artist: "鋒兄 & 塗哥",
    album: "鋒兄音樂精選",
    lyrics: {
      zh: `鋒兄的傳奇人生 
從頭獎到榜首 
從榜首到總統 
三十七歲 
統一發票特別獎得主 
威力彩頭獎得主 
大樂透頭獎得主 
高考三級資訊處理榜首 
放棄報到 
鋒兄塗哥公關資訊 
創業 
五十一歲 
台北市資訊局長 
五十二歲 
台北市副秘書長 
五十三歲 
台北市副市長 
五十四歲 
台北市長候選人 
百億市長 
鋒兄發大財 
幸運台北 
六十三歲 
總統候選人 
一兆總統 
鋒兄發大財 
幸運台灣 
鋒兄的傳奇人生 
從頭獎到榜首 
從榜首到總統`,
      en: ` Feng's Legendary Life 
 From the jackpot to the top 
 From the top to the president 
 At thirty-seven, 
 Winner of the Special Prize in the Receipt Lottery 
 Winner of the Power Lottery Jackpot 
 Winner of the Grand Lottery Jackpot 
 Top of the third-level civil service exam in information processing 
 Declined to report 
 Feng's PR and Information Firm 
 Started a business 
 At fifty-one, 
 Director of Information for Taipei City 
 At fifty-two, 
 Deputy Secretary-General of Taipei City 
 At fifty-three, 
 Deputy Mayor of Taipei City 
 At fifty-four, 
 Mayoral candidate of Taipei City 
 Billion-dollar Mayor 
 Feng made a fortune 
 Lucky Taipei 
 At sixty-three, 
 Presidential candidate 
 Trillion-dollar President 
 Feng made a fortune 
 Lucky Taiwan 
 Feng's Legendary Life 
 From the jackpot to the top 
 From the top to the president`,
      ja: `鋒兄の伝説的人生 
最初の賞からトップへ 
トップから大統領へ 
37歳 
統一インボイス特別賞受賞者 
パワーボール一等賞受賞者 
ロト一等賞受賞者 
高試三級情報処理トップ 
報到を辞退 
鋒兄 塗哥広報情報 
起業 
51歳 
台北市情報局長 
52歳 
台北市副秘書長 
53歳 
台北市副市長 
54歳 
台北市長候補 
億万市長 
鋒兄 大儲け 
幸運の台北 
63歳 
大統領候補 
兆万大統領 
鋒兄 大儲け 
幸運の台湾 
鋒兄の伝説的人生 
最初の賞からトップへ 
トップから大統領へ`,
      yue: `鋒兄嘅傳奇人生 
從頭獎到榜首 
從榜首到總統 
三十七歲 
統一發票特別獎得主 
威力彩頭獎得主 
大樂透頭獎得主 
高考三級資訊處理榜首 
放棄報到 
鋒兄塗哥公關資訊 
創業 
五十一歲 
台北市資訊局長 
五十二歲 
台北市副秘書長 
五十三歲 
台北市副市長 
五十四歲 
台北市長候選人 
百億市長 
鋒兄發大財 
幸運台北 
六十三歲 
總統候選人 
一兆總統 
鋒兄發大財 
幸運台灣 
鋒兄嘅傳奇人生 
從頭獎到榜首 
從榜首到總統`,
      ko: `형 형제의 전설적인 인생 
처음부터 1등까지 
1등에서 대통령까지 
서른일곱 살 
복권 특별 상 수상자 
파워볼 1등 수상자 
로또 1등 수상자 
고시 3급 정보 처리 수석 
등록 포기 
형 형제 도끼 홍보 정보 
창업 
쉰한 살 
타이베이시 정보국장 
쉰둘 살 
타이베이시 부비서장 
쉰셋 살 
타이베이시 부시장 
쉰넷 살 
타이베이 시장 후보 
수십억 시장 
형 형제 대박 
행운의 타이베이 
예순셋 살 
대통령 후보 
조 단위 대통령 
형 형제 대박 
행운의 타이완 
형 형제의 전설적인 인생 
처음부터 1등까지 
1등에서 대통령까지`
    },
    audioFiles: {
      zh: "/musics/鋒兄的傳奇人生.mp3",
      en: "/musics/鋒兄的傳奇人生(英文).mp3",
      ja: "/musics/鋒兄的傳奇人生(日文).mp3",
      yue: "/musics/鋒兄的傳奇人生(粵語).mp3",
      ko: "/musics/鋒兄的傳奇人生(韓文).mp3"
    },
    audioVariations: {
      zh: [
        { name: "原始音樂", url: "/musics/鋒兄的傳奇人生.mp3" },
        { name: "Donald Trump", url: "/musics/鋒兄的傳奇人生(Donald Trump).mp3" },
        { name: "Pekora", url: "/musics/鋒兄的傳奇人生(Pekora).mp3" },
        { name: "SpongeBob SquarePants", url: "/musics/鋒兄的傳奇人生(SpongeBob SquarePants).mp3" },
        { name: "Hatsune Miku", url: "/musics/鋒兄的傳奇人生(Hatsune Miku).mp3" },
        { name: "Sidhu", url: "/musics/鋒兄的傳奇人生(Sidhu).mp3" },
        { name: "Rose", url: "/musics/鋒兄的傳奇人生 (Rose).mp3" },
        { name: "Freddie Mercury", url: "/musics/鋒兄的傳奇人生(Freddie Mercury).mp3" }
      ]
    },
    genre: "勵志流行",
    year: 2024,
    isFavorite: false,
  },
];

export default function MusicLyrics() {
  // 從 Appwrite 獲取音樂數據
  const { music: appwriteMusic, loading: musicLoading, error: musicError } = useMusic();
  
  const [songs, setSongs] = useState<Song[]>(SAMPLE_SONGS);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'zh' | 'en' | 'ja' | 'yue' | 'ko'>('zh');
  const [searchTerm, setSearchTerm] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);

  const [lyricsSearchTerm, setLyricsSearchTerm] = useState(""); // 歌词内搜索
  const [currentVariation, setCurrentVariation] = useState<string>("default");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [newSong, setNewSong] = useState({
    title: "",
    artist: "",
    album: "",
    lyrics: {
      zh: "",
      en: "",
      ja: "",
      yue: "",
      ko: ""
    },
    genre: "",
    year: new Date().getFullYear(),
  });

  // 將 Appwrite 音樂數據轉換為 Song 格式
  useEffect(() => {
    if (appwriteMusic && appwriteMusic.length > 0) {
      const convertedSongs: Song[] = appwriteMusic.map((music) => {
        // 解析歌詞（假設存儲為 JSON 字符串）
        let parsedLyrics: any = {};
        try {
          parsedLyrics = music.lyrics ? JSON.parse(music.lyrics) : {};
        } catch {
          parsedLyrics = { zh: music.lyrics || "" };
        }

        // 根據 language 字段確定音頻文件的語言
        const lang = (music.language || 'zh') as 'zh' | 'en' | 'ja' | 'yue' | 'ko';
        
        // 確保音頻文件 URL 存在且有效
        const audioUrl = music.file ? getProxiedMediaUrl(music.file) : '';
        
        // 提取基礎歌名（去除括號內容）
        const baseName = music.name.replace(/[\(\uff08].*?[\)\uff09]/g, '').trim();
        
        // 多層次歌詞匹配函數
        const findLyrics = (targetLang: 'zh' | 'en' | 'ja' | 'yue' | 'ko'): string => {
          // 1. 優先使用自己的歌詞
          if (parsedLyrics[targetLang]) {
            console.log(`[findLyrics] ${music.name} - ${targetLang}: Using own lyrics`);
            return parsedLyrics[targetLang];
          }
          if (targetLang === 'zh' && music.lyrics) {
            console.log(`[findLyrics] ${music.name} - zh: Using direct lyrics`);
            return music.lyrics;
          }
          
          // 2. 找基礎版本（去除括號後的版本）
          // 不檢查 language 欄位，只要歌名匹配即可
          const baseVersion = appwriteMusic.find(m => {
            const mBaseName = m.name.replace(/[\(\uff08].*?[\)\uff09]/g, '').trim();
            return mBaseName === baseName && m.name === baseName;
          });
          
          if (baseVersion?.lyrics) {
            try {
              const baseLyrics = JSON.parse(baseVersion.lyrics);
              if (baseLyrics[targetLang]) return baseLyrics[targetLang];
            } catch {
              if (targetLang === 'zh' && baseVersion.lyrics) return baseVersion.lyrics;
            }
          }
          
          return "";

        };
        
        return {
          id: music.$id,
          title: music.name,
          artist: "鋒兄 & 塗哥",
          album: "鋒兄音樂精選",
          lyrics: {
            zh: findLyrics('zh'),
            en: findLyrics('en'),
            ja: findLyrics('ja'),
            yue: findLyrics('yue'),
            ko: findLyrics('ko'),
          },
          audioFiles: {
            zh: audioUrl,
            en: audioUrl,
            ja: audioUrl,
            yue: audioUrl,
            ko: audioUrl,
          },
          genre: music.category || "台灣民謠",
          year: new Date(music.$createdAt).getFullYear(),
          isFavorite: false,
          originalData: music,
        };
      });

      // 合併 Appwrite 數據和示例數據
      setSongs([...convertedSongs, ...SAMPLE_SONGS]);
      
      console.log('[MusicLyrics] Loaded songs from Appwrite:', convertedSongs.length);
      console.log('[MusicLyrics] First song audio URL:', convertedSongs[0]?.audioFiles.zh);
    }
  }, [appwriteMusic]);

  // 格式化歌词显示
  const formatLyrics = useCallback((lyrics: string) => {
    if (!lyrics) return null;

    // 检测歌词格式类型
    const hasStructuredFormat = lyrics.includes('[') && lyrics.includes(']');
    const hasLongNarrative = lyrics.length > 500 && !lyrics.includes('\n\n');
    
    if (hasStructuredFormat) {
      // 结构化歌词格式 (如 [Verse 1], [Chorus] 等)
      return formatStructuredLyrics(lyrics);
    } else if (hasLongNarrative) {
      // 长篇叙事格式 (如塗哥水電王子爆紅)
      return formatNarrativeLyrics(lyrics);
    } else {
      // 普通歌词格式
      return formatRegularLyrics(lyrics);
    }
  }, []);

  // 格式化结构化歌词 (带标签的歌词)
  const formatStructuredLyrics = (lyrics: string) => {
    const lines = lyrics.split('\n');
    return (
      <div className="space-y-3 sm:space-y-4">
        {lines.map((line, index) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return <div key={index} className="h-2" />;
          
          // 检测段落标签 [Intro], [Verse 1], [Chorus] 等
          if (trimmedLine.match(/^\[.*\]$/)) {
            return (
              <div key={index} className="flex items-center gap-2 sm:gap-3 my-4 sm:my-6">
                <div className="h-px bg-gradient-to-r from-purple-400 to-blue-400 flex-1" />
                <span className="px-2 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs sm:text-sm font-semibold rounded-full shadow-lg">
                  {trimmedLine.replace(/[\[\]]/g, '')}
                </span>
                <div className="h-px bg-gradient-to-r from-blue-400 to-purple-400 flex-1" />
              </div>
            );
          }
          
          // 普通歌词行
          return (
            <div key={index} className="text-gray-800 dark:text-gray-200 leading-relaxed text-base sm:text-lg font-medium pl-2 sm:pl-4 py-1 hover:bg-white/50 dark:hover:bg-gray-700/30 rounded transition-colors">
              {trimmedLine}
            </div>
          );
        })}
      </div>
    );
  };

  // 格式化叙事歌词 (长篇连续文本)
  const formatNarrativeLyrics = (lyrics: string) => {
    // 智能分段：根据句号、感叹号等标点符号分段
    const sentences = lyrics.split(/([。！？；])/);
    const paragraphs = [];
    let currentParagraph = '';
    
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      currentParagraph += sentence;
      
      // 每3-4句组成一段，或遇到特定关键词时分段
      if (currentParagraph.length > 150 || 
          sentence.includes('塗哥說') || 
          sentence.includes('鋒兄說') ||
          sentence.includes('同行說') ||
          sentence.includes('林學徒說')) {
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim());
        }
        currentParagraph = '';
      }
    }
    
    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        {paragraphs.map((paragraph, index) => (
          <div key={index} className="group">
            <div className="text-gray-800 dark:text-gray-200 leading-relaxed text-base sm:text-lg font-medium p-3 sm:p-4 bg-white/30 dark:bg-gray-700/20 rounded-lg border-l-4 border-purple-400 hover:border-purple-500 transition-all hover:shadow-md">
              {highlightKeywords(paragraph)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 格式化普通歌词
  const formatRegularLyrics = (lyrics: string) => {
    const lines = lyrics.split('\n');
    return (
      <div className="space-y-2 sm:space-y-3">
        {lines.map((line, index) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return <div key={index} className="h-2 sm:h-3" />;
          
          return (
            <div key={index} className="text-gray-800 dark:text-gray-200 leading-relaxed text-base sm:text-lg font-medium pl-2 sm:pl-4 py-1 sm:py-2 hover:bg-white/50 dark:hover:bg-gray-700/30 rounded transition-colors">
              {highlightKeywords(trimmedLine)}
            </div>
          );
        })}
      </div>
    );
  };

  // 导出歌词
  const exportLyrics = useCallback((format: 'txt' | 'md') => {
    if (!selectedSong) return;
    
    const lyrics = selectedSong.lyrics[currentLanguage];
    if (!lyrics) return;
    
    let content = '';
    const title = `${selectedSong.title} - ${selectedSong.artist}`;
    
    if (format === 'md') {
      content = `# ${title}\n\n`;
      content += `**專輯**: ${selectedSong.album || '未知'}\n`;
      content += `**年份**: ${selectedSong.year || '未知'}\n`;
      content += `**語言**: ${currentLanguage === 'zh' ? '中文' : currentLanguage === 'en' ? 'English' : currentLanguage === 'ja' ? '日本語' : currentLanguage === 'yue' ? '粵語' : '韓語'}\n\n`;
      content += `---\n\n${lyrics}`;
    } else {
      content = `${title}\n`;
      content += `專輯: ${selectedSong.album || '未知'}\n`;
      content += `年份: ${selectedSong.year || '未知'}\n`;
      content += `語言: ${currentLanguage === 'zh' ? '中文' : currentLanguage === 'en' ? 'English' : currentLanguage === 'ja' ? '日本語' : currentLanguage === 'yue' ? '粵語' : '韓語'}\n\n`;
      content += lyrics;
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSong.title}_${currentLanguage}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedSong, currentLanguage]);

  // 复制歌词到剪贴板
  const copyLyrics = useCallback(async () => {
    if (!selectedSong) return;
    
    const lyrics = selectedSong.lyrics[currentLanguage];
    if (!lyrics) return;
    
    try {
      await navigator.clipboard.writeText(lyrics);
      // 这里可以添加一个 toast 通知
      console.log('歌词已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, [selectedSong, currentLanguage]);

  // 高亮关键词和搜索词
  const highlightKeywords = (text: string) => {
    const keywords = ['塗哥', '鋒兄', '水電工', '青木瓜', '台北', '思敏', '蕙瑄'];
    let highlightedText = text;
    
    // 高亮搜索词
    if (lyricsSearchTerm.trim()) {
      const searchRegex = new RegExp(`(${lyricsSearchTerm.trim()})`, 'gi');
      highlightedText = highlightedText.replace(searchRegex, `<mark class="bg-red-200 dark:bg-red-800 px-1 rounded font-semibold">$1</mark>`);
    }
    
    // 高亮关键词
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'g');
      highlightedText = highlightedText.replace(regex, `<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>`);
    });
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  // 搜尋歌曲
  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.album?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.lyrics.zh.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.lyrics.en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.lyrics.ja?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.lyrics.yue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.lyrics.ko?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 切換收藏狀態
  const toggleFavorite = useCallback((songId: string) => {
    setSongs(prev => prev.map(song =>
      song.id === songId ? { ...song, isFavorite: !song.isFavorite } : song
    ));
  }, []);

  // 新增歌曲
  const handleAddSong = useCallback(() => {
    if (!newSong.title || !newSong.artist || !newSong.lyrics.zh) return;

    const song: Song = {
      id: Date.now().toString(),
      title: newSong.title,
      artist: newSong.artist,
      album: newSong.album || undefined,
      lyrics: {
        zh: newSong.lyrics.zh,
        en: newSong.lyrics.en || undefined,
        ja: newSong.lyrics.ja || undefined,
        yue: newSong.lyrics.yue || undefined,
        ko: newSong.lyrics.ko || undefined,
      },
      audioFiles: {
        zh: "",
        en: newSong.lyrics.en ? "" : undefined,
        ja: newSong.lyrics.ja ? "" : undefined,
        yue: newSong.lyrics.yue ? "" : undefined,
        ko: newSong.lyrics.ko ? "" : undefined,
      },
      genre: newSong.genre || undefined,
      year: newSong.year || undefined,
      isFavorite: false,
    };

    setSongs(prev => [...prev, song]);
    setNewSong({
      title: "",
      artist: "",
      album: "",
      lyrics: {
        zh: "",
        en: "",
        ja: "",
        yue: "",
        ko: ""
      },
      genre: "",
      year: new Date().getFullYear(),
    });
    setShowAddForm(false);
  }, [newSong]);

  // 簡單的音頻生成備用方案
  const createSimpleAudio = useCallback((songTitle: string) => {
    try {
      // 使用 Web Audio API 創建簡單的音調
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // 根據歌曲選擇頻率
      let frequency = 440; // A4
      if (songTitle.includes('塗哥')) frequency = 523; // C5
      if (songTitle.includes('結婚')) frequency = 392; // G4
      if (songTitle.includes('進化')) frequency = 659; // E5
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 2);
      
      return true;
    } catch (error) {
      console.error('Simple audio generation failed:', error);
      return false;
    }
  }, []);
  const generateAudioBlob = useCallback((songTitle: string, duration: number = 30) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    // 根據歌曲標題選擇不同的頻率
    let frequencies: number[];
    if (songTitle.includes('塗哥水電王子')) {
      frequencies = [440, 523, 659, 784]; // A, C, E, G
    } else if (songTitle.includes('結婚理由')) {
      frequencies = [330, 392, 494, 587]; // E, G, B, D
    } else if (songTitle.includes('進化Show')) {
      frequencies = [262, 330, 392, 523]; // C, E, G, C
    } else if (songTitle.includes('傳奇人生')) {
      frequencies = [293, 369, 440, 587]; // D, F#, A, D
    } else {
      frequencies = [440, 523, 659]; // 默認
    }
    
    // 生成簡單的旋律
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      let sample = 0;
      
      // 創建簡單的旋律模式
      const freqIndex = Math.floor((time * frequencies.length / duration * 4)) % frequencies.length;
      const freq = frequencies[freqIndex];
      
      // 添加和聲
      sample += Math.sin(2 * Math.PI * freq * time) * 0.3;
      sample += Math.sin(2 * Math.PI * freq * 1.5 * time) * 0.15;
      
      // 添加節拍
      const beat = Math.floor(time * 2) % 4;
      if (beat === 0 || beat === 2) {
        sample *= 1.3;
      }
      
      // 淡入淡出
      const fadeTime = 1;
      if (time < fadeTime) {
        sample *= time / fadeTime;
      } else if (time > duration - fadeTime) {
        sample *= (duration - time) / fadeTime;
      }
      
      data[i] = sample * 0.4;
    }
    
    return buffer;
  }, []);

  // 創建音頻URL
  const createAudioUrl = useCallback(async (songTitle: string, duration: number = 30) => {
    try {
      const buffer = generateAudioBlob(songTitle, duration);
      
      // 轉換為WAV格式
      const length = buffer.length;
      const arrayBuffer = new ArrayBuffer(44 + length * 2);
      const view = new DataView(arrayBuffer);
      
      // WAV header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + length * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, buffer.sampleRate, true);
      view.setUint32(28, buffer.sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, length * 2, true);
      
      // 轉換浮點樣本為16位PCM
      const data = buffer.getChannelData(0);
      let offset = 44;
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, data[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
      
      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to generate audio:', error);
      return null;
    }
  }, [generateAudioBlob]);
  const startDemoPlayback = useCallback(() => {
    console.warn('[Demo] Starting demo playback mode - real audio failed to load');
    setDuration(180); // 3分鐘模擬時長
    setCurrentTime(0);
    setIsPlaying(true);
    
    // 創建模擬進度更新
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= 180) {
          setIsPlaying(false);
          setCurrentTime(0);
          clearInterval(interval);
          return 0;
        }
        return newTime;
      });
    }, 1000);
    
    // 保存interval引用以便清理
    const mockAudio = {
      pause: () => {
        clearInterval(interval);
        setIsPlaying(false);
      },
      currentTime: 0,
      duration: 180,
      volume: volume
    } as any;
    
    setCurrentAudio(mockAudio);
  }, [volume]);

  // 获取当前音频URL
  const getCurrentAudioUrl = useCallback(() => {
    if (!selectedSong) return null;
    
    // 如果有变体且选择了非默认变体
    if (currentVariation !== "default" && 
        selectedSong.audioVariations?.[currentLanguage]) {
      const variation = selectedSong.audioVariations[currentLanguage]?.find(v => v.name === currentVariation);
      if (variation) return getProxiedMediaUrl(variation.url);
    }
    
    // 嘗試獲取當前語言的音頻文件
    const audioUrl = selectedSong.audioFiles[currentLanguage];
    if (audioUrl) {
      console.log(`[getCurrentAudioUrl] Using ${currentLanguage} audio:`, audioUrl);
      return getProxiedMediaUrl(audioUrl);
    }
    
    // 如果當前語言沒有音頻，回退到中文
    const fallbackUrl = selectedSong.audioFiles.zh;
    if (fallbackUrl) {
      console.log(`[getCurrentAudioUrl] Fallback to zh audio:`, fallbackUrl);
      return getProxiedMediaUrl(fallbackUrl);
    }
    
    // 嘗試任何可用的音頻文件
    const availableAudio = Object.values(selectedSong.audioFiles).find(url => url);
    if (availableAudio) {
      console.log(`[getCurrentAudioUrl] Using any available audio:`, availableAudio);
      return getProxiedMediaUrl(availableAudio);
    }
    
    console.warn('[getCurrentAudioUrl] No audio file available');
    return null;
  }, [selectedSong, currentLanguage, currentVariation]);

  // 当变体改变时停止播放
  useEffect(() => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentVariation]);

  // 当歌曲或语言改变时更新默认变体
  useEffect(() => {
    if (selectedSong?.audioVariations?.[currentLanguage]) {
      setCurrentVariation(selectedSong.audioVariations[currentLanguage]![0].name);
    } else {
      setCurrentVariation("default");
    }
  }, [selectedSong, currentLanguage]);

  // 播放控制
  const togglePlay = useCallback(() => {
    if (!selectedSong) {
      console.warn('[togglePlay] No song selected');
      return;
    }

    if (currentAudio) {
      if (isPlaying) {
        currentAudio.pause();
        setIsPlaying(false);
        console.log('[togglePlay] Paused');
      } else {
        currentAudio.play().catch((error) => {
          console.warn('[togglePlay] Audio playback failed:', error);
        });
        setIsPlaying(true);
        console.log('[togglePlay] Resumed');
      }
    } else {
      const audioFile = getCurrentAudioUrl();
      console.log('[togglePlay] Audio file URL:', audioFile);
      console.log('[togglePlay] Current language:', currentLanguage);
      console.log('[togglePlay] Selected song:', selectedSong.title);
      console.log('[togglePlay] Audio files:', selectedSong.audioFiles);
      
      if (audioFile) {
        const audio = new Audio();
        
        // 設置音頻事件監聽器
        audio.addEventListener('loadedmetadata', () => {
          setDuration(audio.duration);
          console.log(`[Audio] Loaded metadata: ${audio.duration}s`);
        });
        
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
        });
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
          setCurrentAudio(null);
          console.log('[Audio] Playback ended');
        });
        
        audio.addEventListener('error', (e) => {
          console.error('[Audio] Error event:', e);
          console.error('[Audio] Error details:', {
            error: audio.error,
            code: audio.error?.code,
            message: audio.error?.message,
            networkState: audio.networkState,
            readyState: audio.readyState
          });
          console.warn(`[Audio] Failed to load: ${audioFile}`);
          // 如果音頻文件加載失敗，使用模擬播放
          startDemoPlayback();
        });
        
        audio.addEventListener('canplay', () => {
          console.log('[Audio] Can start playing');
        });
        
        audio.addEventListener('loadstart', () => {
          console.log('[Audio] Loading started');
        });
        
        audio.volume = volume;
        audio.src = audioFile;
        setCurrentAudio(audio);
        audioRef.current = audio;
        
        // 嘗試播放真實音頻
        console.log(`[Audio] Attempting to play: ${audioFile}`);
        console.log(`[Audio] Audio element ready state: ${audio.readyState}`);
        console.log(`[Audio] Audio element network state: ${audio.networkState}`);
        
        audio.load();
        
        // 給音頻一些時間加載
        setTimeout(() => {
          audio.play().then(() => {
            console.log('[Audio] Playback started successfully');
            setIsPlaying(true);
          }).catch((error) => {
            console.error('[Audio] Playback failed:', error);
            console.error('[Audio] Error name:', error.name);
            console.error('[Audio] Error message:', error.message);
            
            // 只有在真正無法播放時才切換到模擬模式
            if (error.name === 'NotSupportedError' || error.name === 'NotAllowedError') {
              console.log('[Audio] Switching to demo mode due to:', error.name);
              startDemoPlayback();
            } else {
              console.log('[Audio] Retrying playback...');
              // 重試一次
              setTimeout(() => {
                audio.play().catch(() => {
                  console.log('[Audio] Retry failed, switching to demo mode');
                  startDemoPlayback();
                });
              }, 500);
            }
          });
        }, 100);
      } else {
        console.log('[togglePlay] No audio file available, using demo mode');
        console.log('[togglePlay] audioFile value:', audioFile);
        startDemoPlayback();
      }
    }
  }, [selectedSong, currentLanguage, currentAudio, isPlaying, volume, startDemoPlayback, getCurrentAudioUrl]);

  // 進度條控制
  const handleProgressChange = useCallback((value: number[]) => {
    if (currentAudio && duration > 0) {
      const newTime = (value[0] / 100) * duration;
      if (currentAudio.currentTime !== undefined) {
        currentAudio.currentTime = newTime;
      }
      setCurrentTime(newTime);
    }
  }, [currentAudio, duration]);

  // 音量控制
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (currentAudio && currentAudio.volume !== undefined) {
      currentAudio.volume = newVolume;
    }
  }, [currentAudio]);

  // 快進/快退
  const skipForward = useCallback(() => {
    if (currentAudio) {
      const newTime = Math.min(currentTime + 10, duration);
      if (currentAudio.currentTime !== undefined) {
        currentAudio.currentTime = newTime;
      }
      setCurrentTime(newTime);
    }
  }, [currentAudio, currentTime, duration]);

  const skipBackward = useCallback(() => {
    if (currentAudio) {
      const newTime = Math.max(currentTime - 10, 0);
      if (currentAudio.currentTime !== undefined) {
        currentAudio.currentTime = newTime;
      }
      setCurrentTime(newTime);
    }
  }, [currentAudio, currentTime]);

  // 格式化時間
  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 切換語言
  const handleLanguageChange = useCallback((language: 'zh' | 'en' | 'ja' | 'yue' | 'ko') => {
    setCurrentLanguage(language);
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentAudio]);

  // 停止播放
  const stopPlay = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [currentAudio]);

  // 清理音頻資源
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
    };
  }, [currentAudio]);

  // 當選擇的歌曲改變時停止播放
  useEffect(() => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [selectedSong]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="鋒兄音樂"
        subtitle="播放您喜愛的歌曲與查看歌詞"
        showAccountLabel={true}
        action={
          <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
            <Plus size={16} />
            新增歌曲
          </Button>
        }
      />

      {/* 加載狀態 */}
      {musicLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">正在載入音樂...</p>
        </div>
      )}

      {/* 錯誤狀態 */}
      {musicError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">載入音樂失敗: {musicError}</p>
        </div>
      )}

      {/* 添加歌词样式 */}
      <style jsx>{`
        .lyrics-container {
          font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.8;
        }
        
        .lyrics-container mark {
          background: linear-gradient(120deg, #fbbf24 0%, #f59e0b 100%);
          color: #1f2937;
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .dark .lyrics-container mark {
          background: linear-gradient(120deg, #d97706 0%, #b45309 100%);
          color: #f9fafb;
        }
        
        .lyrics-container .narrative-paragraph {
          position: relative;
          overflow: hidden;
        }
        
        .lyrics-container .narrative-paragraph::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(to bottom, #8b5cf6, #3b82f6);
          border-radius: 2px;
        }
        
        .lyrics-container .verse-line {
          position: relative;
          padding-left: 1rem;
        }
        
        .lyrics-container .verse-line::before {
          content: '♪';
          position: absolute;
          left: 0;
          color: #8b5cf6;
          font-size: 0.875rem;
          opacity: 0.6;
        }
        
        .lyrics-container .section-divider {
          background: linear-gradient(90deg, transparent, #8b5cf6, #3b82f6, transparent);
          height: 2px;
          margin: 1.5rem 0;
          border-radius: 1px;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 歌曲列表 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">歌曲庫</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="搜尋歌曲、歌手或專輯..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    className={`p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      selectedSong?.id === song.id ? "bg-purple-50 dark:bg-purple-900/20" : ""
                    }`}
                    onClick={() => {
                      console.log('[Song Selected]', song.title);
                      console.log('[Song Audio Files]', song.audioFiles);
                      setSelectedSong(song);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
                          {song.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                          {song.artist}
                        </p>
                        {song.album && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {song.album}
                          </p>
                        )}
                        {/* 語言標籤 - 手機優化 */}
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">中</Badge>
                          {song.lyrics.en && <Badge variant="outline" className="text-xs px-1.5 py-0.5">EN</Badge>}
                          {song.lyrics.ja && <Badge variant="outline" className="text-xs px-1.5 py-0.5">日</Badge>}
                          {song.lyrics.yue && <Badge variant="outline" className="text-xs px-1.5 py-0.5">粵</Badge>}
                          {song.lyrics.ko && <Badge variant="outline" className="text-xs px-1.5 py-0.5">韓</Badge>}
                        </div>
                        
                        {/* 歌词预览 - 手機優化 */}
                        {selectedSong?.id !== song.id && (
                          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 line-clamp-2">
                            {song.lyrics.zh.substring(0, 80)}...
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(song.id);
                        }}
                        className="ml-1 flex-shrink-0"
                      >
                        <Heart
                          size={16}
                          className={song.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"}
                        />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 歌詞顯示 */}
        <div className="lg:col-span-2">
          {selectedSong ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{selectedSong.title}</CardTitle>
                    <CardDescription className="text-base mt-1">
                      {selectedSong.artist}
                      {selectedSong.album && ` • ${selectedSong.album}`}
                      {selectedSong.year && ` • ${selectedSong.year}`}
                    </CardDescription>
                    {selectedSong.genre && (
                      <Badge variant="secondary" className="mt-2">
                        {selectedSong.genre}
                      </Badge>
                    )}
                  </div>
                  
                  {/* 桌面版播放控制 - 增強版 */}
                  <div className="flex flex-col items-end gap-2">
                    {/* 時間顯示 */}
                    {currentAudio && duration > 0 && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">
                          {formatTime(currentTime)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          / {formatTime(duration)}
                        </div>
                      </div>
                    )}
                    
                    {/* 播放按鈕組 */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(selectedSong.id)}
                      >
                        <Heart
                          size={16}
                          className={selectedSong.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"}
                        />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={skipBackward}
                        disabled={!currentAudio}
                      >
                        <SkipBack size={16} />
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={togglePlay}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        <span className="ml-1">{isPlaying ? '暫停' : '播放'}</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={skipForward}
                        disabled={!currentAudio}
                      >
                        <SkipForward size={16} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={stopPlay}
                        disabled={!currentAudio}
                      >
                        <Volume2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* 桌面版時間軸 - 在 Header 中 */}
                {currentAudio && duration > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="relative">
                      {/* 進度條背景 */}
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        {/* 已播放進度 */}
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                      </div>
                      
                      {/* 可拖動的滑塊 */}
                      <div className="absolute top-0 left-0 w-full h-2">
                        <Slider
                          value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                          onValueChange={handleProgressChange}
                          max={100}
                          step={0.1}
                          className="w-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                          disabled={!currentAudio || duration === 0}
                        />
                      </div>
                    </div>
                    
                    {/* 時間標記 */}
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500">
                      <span>0:00</span>
                      <span>{formatTime(duration / 4)}</span>
                      <span>{formatTime(duration / 2)}</span>
                      <span>{formatTime(duration * 3 / 4)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    
                    {/* 音量控制 */}
                    <div className="flex items-center gap-3 pt-2">
                      <Volume2 size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <div className="flex-1 max-w-xs">
                        <Slider
                          value={[volume * 100]}
                          onValueChange={handleVolumeChange}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right font-mono">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Tabs value={currentLanguage} onValueChange={(value) => handleLanguageChange(value as 'zh' | 'en' | 'ja' | 'yue' | 'ko')}>
                  {/* 語言切換 - 手機優化版 */}
                  <div className="mb-4 space-y-3">
                    {/* 語言選擇 - 響應式網格 */}
                    <div className="w-full">
                      <TabsList className="grid w-full grid-cols-5 gap-1 h-auto p-1">
                        <TabsTrigger 
                          value="zh" 
                          className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                        >
                          <span className="hidden sm:inline">中文</span>
                          <span className="sm:hidden">中</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="en" 
                          disabled={!selectedSong.lyrics.en}
                          className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                        >
                          <span className="hidden sm:inline">English</span>
                          <span className="sm:hidden">EN</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="ja" 
                          disabled={!selectedSong.lyrics.ja}
                          className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                        >
                          <span className="hidden sm:inline">日本語</span>
                          <span className="sm:hidden">日</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="yue" 
                          disabled={!selectedSong.lyrics.yue}
                          className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                        >
                          <span className="hidden sm:inline">粵語</span>
                          <span className="sm:hidden">粵</span>
                        </TabsTrigger>
                        <TabsTrigger 
                          value="ko" 
                          disabled={!selectedSong.lyrics.ko}
                          className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                        >
                          <span className="hidden sm:inline">韓語</span>
                          <span className="sm:hidden">韓</span>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    
                    {/* 导出和复制功能 - 手機優化 */}
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={copyLyrics}
                        className="flex items-center gap-1 text-xs sm:text-sm"
                      >
                        <Copy size={14} />
                        <span className="hidden sm:inline">複製</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => exportLyrics('txt')}
                        className="flex items-center gap-1 text-xs sm:text-sm"
                      >
                        <Download size={14} />
                        <span>TXT</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => exportLyrics('md')}
                        className="flex items-center gap-1 text-xs sm:text-sm"
                      >
                        <Download size={14} />
                        <span>MD</span>
                      </Button>
                    </div>
                  </div>
                  
                  {/* 歌词内搜索 - 手機優化 */}
                  <div className="mb-4">
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <Input
                        placeholder="在歌詞中搜尋..."
                        value={lyricsSearchTerm}
                        onChange={(e) => setLyricsSearchTerm(e.target.value)}
                        className="pl-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Variation Selector - 手機優化 */}
                  {selectedSong.audioVariations?.[currentLanguage] && (
                    <div className="mb-4">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        選擇版本 / Version
                      </label>
                      <Select 
                        value={currentVariation === 'default' && selectedSong.audioVariations?.[currentLanguage] ? selectedSong.audioVariations[currentLanguage][0].name : currentVariation} 
                        onValueChange={setCurrentVariation}
                      >
                        <SelectTrigger className="w-[240px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                          <SelectValue placeholder="選擇版本" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedSong.audioVariations[currentLanguage]!.map((variation, index) => (
                            <SelectItem key={index} value={variation.name}>
                              {variation.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <TabsContent value="zh" className="mt-4">
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                      <div className="lyrics-container text-sm sm:text-base">
                        {formatLyrics(selectedSong.lyrics.zh)}
                      </div>
                    </div>
                  </TabsContent>
                  {selectedSong.lyrics.en && (
                    <TabsContent value="en" className="mt-4">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                        <div className="lyrics-container text-sm sm:text-base">
                          {formatLyrics(selectedSong.lyrics.en)}
                        </div>
                      </div>
                    </TabsContent>
                  )}
                  {selectedSong.lyrics.ja && (
                    <TabsContent value="ja" className="mt-4">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                        <div className="lyrics-container text-sm sm:text-base">
                          {formatLyrics(selectedSong.lyrics.ja)}
                        </div>
                      </div>
                    </TabsContent>
                  )}
                  {selectedSong.lyrics.yue && (
                    <TabsContent value="yue" className="mt-4">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                        <div className="lyrics-container text-sm sm:text-base">
                          {formatLyrics(selectedSong.lyrics.yue)}
                        </div>
                      </div>
                    </TabsContent>
                  )}
                  {selectedSong.lyrics.ko && (
                    <TabsContent value="ko" className="mt-4">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
                        <div className="lyrics-container text-sm sm:text-base">
                          {formatLyrics(selectedSong.lyrics.ko)}
                        </div>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
                
                {/* 音樂播放器控制界面 - 手機優化 */}
                {selectedSong.audioFiles && (selectedSong.audioFiles[currentLanguage] || selectedSong.audioFiles.zh) ? (
                  <div className="mt-6 p-3 sm:p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    
                    {/* 調試信息 */}
                    {!selectedSong.audioFiles[currentLanguage] && (
                      <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                        ⚠️ 當前語言（{currentLanguage}）沒有音頻文件，使用中文版本
                      </div>
                    )}
                    {/* 播放信息 - 手機優化 */}
                    <div className="mb-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            正在播放: {currentLanguage === 'zh' ? '中文版' : currentLanguage === 'en' ? '英文版' : currentLanguage === 'ja' ? '日文版' : currentLanguage === 'yue' ? '粵語版' : '韓語版'}
                            {currentVariation !== 'default' && ` - ${currentVariation}`}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {selectedSong.title} - {selectedSong.artist}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            🎵 {currentAudio ? 'Appwrite Storage' : '準備播放'}
                          </p>
                        </div>
                        
                        {/* 大時間顯示 */}
                        {currentAudio && duration > 0 && (
                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 font-mono">
                              {formatTime(currentTime)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              / {formatTime(duration)}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 播放控制按鈕 - 手機優化 */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={skipBackward} disabled={!currentAudio} className="text-xs">
                          <SkipBack size={14} />
                        </Button>
                        <Button size="sm" onClick={togglePlay} className="bg-purple-600 hover:bg-purple-700 text-xs sm:text-sm">
                          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                          <span className="ml-1">{isPlaying ? '暫停' : '播放'}</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={skipForward} disabled={!currentAudio} className="text-xs">
                          <SkipForward size={14} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={stopPlay} disabled={!currentAudio} className="text-xs">
                          停止
                        </Button>
                      </div>
                    </div>
                    
                    {/* 時間軸和進度條 - 增強版 */}
                    <div className="space-y-4">
                      {/* 播放進度時間軸 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">播放進度</span>
                          <span className="font-mono">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                        </div>
                        
                        <div className="relative">
                          {/* 進度條背景 */}
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            {/* 已播放進度 */}
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                            />
                          </div>
                          
                          {/* 可拖動的滑塊 */}
                          <div className="absolute top-0 left-0 w-full h-2">
                            <Slider
                              value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                              onValueChange={handleProgressChange}
                              max={100}
                              step={0.1}
                              className="w-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                              disabled={!currentAudio || duration === 0}
                            />
                          </div>
                        </div>
                        
                        {/* 時間標記 */}
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500">
                          <span>0:00</span>
                          <span>{formatTime(duration / 4)}</span>
                          <span>{formatTime(duration / 2)}</span>
                          <span>{formatTime(duration * 3 / 4)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>
                      
                      {/* 音量控制 */}
                      <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Volume2 size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <div className="flex-1 max-w-xs">
                          <Slider
                            value={[volume * 100]}
                            onValueChange={handleVolumeChange}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right font-mono">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 p-3 sm:p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="text-center text-red-600 dark:text-red-400">
                      <p className="font-medium">❌ 無法播放</p>
                      <p className="text-sm mt-1">此歌曲沒有可用的音頻文件</p>
                      <p className="text-xs mt-2">請檢查 Appwrite Storage 中的音頻文件</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Music className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    選擇一首歌曲
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    從左側列表中選擇歌曲來查看歌詞
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 底部固定播放器 */}
      {selectedSong && currentAudio && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-40">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Music className="text-white" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {selectedSong.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {selectedSong.artist} • {currentLanguage === 'zh' ? '中文版' : currentLanguage === 'en' ? '英文版' : currentLanguage === 'ja' ? '日文版' : '粵語版'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={skipBackward}>
                    <SkipBack size={16} />
                  </Button>
                  <Button size="sm" onClick={togglePlay} className="bg-purple-600 hover:bg-purple-700">
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={skipForward}>
                    <SkipForward size={16} />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(currentTime)}
                  </span>
                  <div className="w-32">
                    <Slider
                      value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                      onValueChange={handleProgressChange}
                      max={100}
                      step={0.1}
                      className="w-full"
                      disabled={duration === 0}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(duration)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-gray-500 dark:text-gray-400" />
                  <div className="w-20">
                    <Slider
                      value={[volume * 100]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <Button size="sm" variant="ghost" onClick={stopPlay}>
                  停止
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
