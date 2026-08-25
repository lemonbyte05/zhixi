/* ============================================================
   知息 ZHI XI · 场馆与展品数据
   数据结构面向"可更换场馆"设计：核心逻辑只读取 MUSEUMS[currentMuseumId]
   来源分级：source:'public' = 依据公开资料整理；source:'demo' = Demo 模拟内容
   ============================================================ */
window.MUSEUMS = {
  sdm: {
    id: 'sdm',
    name: '山东博物馆',
    shortName: '山东博物馆',
    city: '济南',
    note: '样板场景：场馆信息依据公开资料整理；展品讲解内容为演示用途，含 Demo 模拟数据。',
    map: { w: 380, h: 580 },
    lobby: { x: 185, y: 520, label: '入口大厅' },
    galleries: {
      g_bronze:  { name: '商周青铜艺术', floor: '2F', rect: [30, 64, 232, 196] },
      g_ceramic: { name: '史前与陶瓷之光', floor: '2F', rect: [276, 64, 84, 196] },
      g_han:     { name: '汉代画像艺术', floor: '1F', rect: [30, 296, 172, 128] },
      g_buddha:  { name: '佛教造像艺术', floor: '1F', rect: [236, 296, 114, 128] },
      g_arch:    { name: '考古山东', floor: '3F', rect: [30, 452, 156, 92] },
      g_luwang:  { name: '明代鲁王展', floor: '2F', rect: [216, 452, 134, 92] }
    },
    /* 距离换算：单位长度→公里 / 步行速度 */
    kmPerUnit: 0.0011,
    walkMinPerKm: 12,
    topics: {
      bronze:  { name: '青铜礼制', desc: '鼎簋钺壶里的秩序与身份' },
      life:    { name: '古代生活', desc: '古人怎么吃、住、打扮' },
      war:     { name: '战争文化', desc: '兵器、兵法与武备' },
      ceramic: { name: '陶瓷之美', desc: '从史前陶器到瓷器' },
      buddha:  { name: '佛教造像', desc: '石刻与信仰的样式' },
      hanart:  { name: '汉代画像', desc: '石头上的汉代世界' },
      text:    { name: '文字与简牍', desc: '早期书写与典籍' }
    },
    products: [
      { id: 'p1', name: '青铜纹样书签', price: '¥18',
        why: '灵感来自你今天停留最久的青铜器纹饰，把那道云雷纹夹进书里。',
        topics: ['bronze'], art: 'bookmark' },
      { id: 'p2', name: '青铜主题笔记本', price: '¥32',
        why: '今天你在青铜礼制上留下了最深的兴趣，这本册子可以继续记录它。',
        topics: ['bronze'], art: 'notebook' },
      { id: 'p3', name: '青铜文化小册', price: '¥25',
        why: '从你今天看过的鼎与簋出发，继续讲完没来得及看的那部分故事。',
        topics: ['bronze', 'text'], art: 'booklet' },
      { id: 'p4', name: '纹样明信片套装', price: '¥22',
        why: '选自今日路线中出现的纹饰与器型，适合寄给同好的人。',
        topics: ['hanart', 'bronze'], art: 'cards' }
    ]
  }
};

/* 展品图鉴：按材质给 SVG 线描图 + 底纹 */
window.ART_KINDS = ['yue','ding','gui','jue','zun','bell','hu','mirror','eggcup','beast','li','pen','slips','bone','sword','mural','buddha','crown','box','cloth'];

window.EXHIBITS = [
  /* ---------- 商周青铜（核心线） ---------- */
  { id:'E01', title:'亚醜钺', kind:'yue', period:'商代晚期', gallery:'g_bronze', x:78, y:118,
    topic:'bronze', priority:3, stay:5, difficulty:2, source:'public',
    short:'一张带"笑脸"的青铜大钺，商代王权与军权的象征物之一。',
    insight:'它不只是兵器——钺是身份与生杀之权的标志，握着它的人，握着当时社会的秩序。',
    detail:'亚醜钺出土于青州苏埠屯商代大墓，器身透雕出张口露齿的人面形兽面纹，神情威严又近乎"微笑"。在商代，钺很少真正用于战场搏杀，更多出现在仪式与刑杀场合，是军事统帅权的象征。文献记载商王曾授予贵族"秉钺"以统领军队。一件兵器的意义不在锋利，而在它代表谁说话。墓的规模与钺的等级相互印证，指向一位地位极高的方国首领。',
    light:'最值得记住的是：钺不是普通兵器，而是身份与权力的象征。',
    related:['E02','E04','E15'] },
  { id:'E02', title:'颂簋', kind:'gui', period:'西周晚期', gallery:'g_bronze', x:168, y:108,
    topic:'bronze', priority:3, stay:5, difficulty:2, source:'public',
    short:'一套完整的西周盛食礼器，腹内铭文记录了一场周王的册命典礼。',
    insight:'簋与鼎配对使用，数量有严格规定——你在看一部写在铜器上的"等级制度说明书"。',
    detail:'颂簋为西周晚期重器，盖与器内对铭各一百五十余字，记述了名为"颂"的贵族受周王册命、获赐命服与土地的过程。西周礼制中鼎与簋按使用者身份组合，天子九鼎八簋，逐级递减，不可僭越。铭文还记录了颂为纪念此事铸器、祈求先祖庇佑。一件食器因此成为礼仪、政治与家族记忆的三重载体。清雍正年间出土于山东，流传经历颇为传奇。',
    light:'最值得记住的是：鼎簋的数量对应身份等级，多一件少一件都不行。',
    related:['E01','E04','E07'] },
  { id:'E03', title:'云雷纹铜爵', kind:'jue', period:'商代', gallery:'g_bronze', x:96, y:178,
    topic:'bronze', priority:1, stay:3, difficulty:1, source:'demo',
    short:'三足细腰的温酒与饮酒器，器身满饰云雷纹。',
    insight:'爵是青铜礼器组合里最常见的酒器，酒在商人祭祀中几乎是沟通神灵的语言。',
    detail:'爵前有流、后有尾、口沿立柱、下承三棱足，造型在实用之外高度程式化。商代人尚酒，祭祀时以酒献神，爵因此频繁出现在墓葬组合中。云雷纹以细密的回旋线条铺满器身，在烛火下明暗流动。（本条目讲解内容为 Demo 模拟内容，供产品演示使用。）',
    light:'最值得记住的是：爵是商代祭祀用酒器，酒在当时是沟通天地的方式。',
    related:['E01','E04','E05'] },
  { id:'E04', title:'兽面纹铜鼎', kind:'ding', period:'商代', gallery:'g_bronze', x:176, y:176,
    topic:'bronze', priority:2, stay:5, difficulty:1, source:'demo',
    short:'立耳柱足的圆形铜鼎，腹部饰典型的兽面纹。',
    insight:'鼎从煮肉的锅变成国家重器，"问鼎"一词说的就是它背后的权力含义。',
    detail:'鼎是青铜礼器的核心：双立耳、圆腹、柱足，腹部主纹为双目突出的兽面纹，辅以云雷纹地。传说夏禹收九牧之金铸九鼎，从此鼎成为政权正统的象征，楚庄王"问鼎之大小轻重"即被视为对王权的挑战。日常语境里"一言九鼎"，也延续着这份分量。（本条目讲解内容为 Demo 模拟内容。）',
    light:'最值得记住的是：鼎由炊具演变为权力象征，"问鼎"就是争天下。',
    related:['E01','E02','E03'] },
  { id:'E05', title:'夔纹铜觥', kind:'zun', period:'西周', gallery:'g_bronze', x:238, y:132,
    topic:'bronze', priority:1, stay:4, difficulty:2, source:'demo',
    short:'兽形容酒器，盖作兽首状，通饰夔龙纹。',
    insight:'觥筹交错的"觥"就是它——一件能装下整场宴席想象力的酒器。',
    detail:'觥多为椭圆形兽形容器，带兽首盖与鋬，用于盛酒与斟酒。夔纹是一种一足两角的龙形纹样，常见于商末周初。成语"觥筹交错"描绘宴饮尽欢，正是这类器物留存在语言里的痕迹。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是："觥筹交错"的觥，就是这种兽形盛酒器。',
    related:['E03','E07','E06'] },
  { id:'E06', title:'青铜编钮钟（一组）', kind:'bell', period:'春秋', gallery:'g_bronze', x:238, y:206,
    topic:'bronze', priority:2, stay:3, difficulty:1, source:'demo',
    short:'大小成组的乐钟，敲击不同部位可以发出不同音高。',
    insight:'编钟证明"礼"和"乐"是一体的——音律的秩序，也是社会的秩序。',
    detail:'编钟按大小依次成组，钟体合瓦形，正鼓与侧鼓位置可发出两个相差三度的音。先秦"钟鸣鼎食"之家，钟与鼎同为身份配置：鼎管吃祭的等级，钟管听乐的等级。演奏时音色浑厚悠长，是礼乐制度的听觉版本。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：编钟一钟双音，礼与乐共用同一套等级。',
    related:['E02','E05','E13'] },
  { id:'E07', title:'错金银铜壶', kind:'hu', period:'战国', gallery:'g_bronze', x:150, y:236,
    topic:'bronze', priority:2, stay:4, difficulty:2, source:'demo',
    short:'以金银丝嵌入纹样的铜壶，线条在暗色铜面上发亮。',
    insight:'错金工艺说明战国工匠已经能把金属当作"画笔"来使用。',
    detail:'错金银是在铜器表面预刻凹槽，嵌入金银丝或金银片后打磨平滑的工艺，盛行于战国至汉。壶身流云与几何纹样交织，金色暗淡沉稳、银色微亮，形成近乎水墨的效果。这类工艺器物多出自高级贵族墓，兼具实用与炫技。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：错金=在铜上"画"金银线，战国的顶级装饰工艺。',
    related:['E02','E05','E08'] },
  { id:'E08', title:'历代铜镜选萃', kind:'mirror', period:'战国—汉', gallery:'g_bronze', x:58, y:236,
    topic:'life', priority:1, stay:2, difficulty:1, source:'demo',
    short:'一组背面带纹饰与铭文的铜镜。',
    insight:'镜子照的是脸，背面刻的是心愿——"见日之光"之类的铭文是最早的祝福语。',
    detail:'铜镜正面磨光照容，背面布钮与纹饰：战国山字纹、汉代规矩纹与吉祥铭文各有时代气质。"长宜子孙""位至三公"等短语直接铸在镜背，像随身携带的祝愿卡。铜镜也是墓葬中常见的随葬品，映照着古人对日常与彼岸的双重经营。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：铜镜背面常铸吉祥语，是最早的"祝福文创"。',
    related:['E07','E24','E19'] },

  /* ---------- 史前与陶瓷 ---------- */
  { id:'E09', title:'蛋壳黑陶杯', kind:'eggcup', period:'龙山文化（约前2500年）', gallery:'g_ceramic', x:318, y:110,
    topic:'ceramic', priority:2, stay:4, difficulty:2, source:'public',
    short:'壁薄如蛋壳、乌黑发亮的四千年前高柄杯，山东龙山文化的巅峰之作。',
    insight:'四千多年前没有轮式车床，先民却做出了不足半毫米厚的杯壁——技术与审美同时到位。',
    detail:'蛋壳黑陶杯出自章丘龙山文化遗址一带，平均壁厚不过0.3—0.5毫米，最薄处仅0.2毫米，"黑如漆、亮如镜、薄如纸、硬如瓷"。制坯采用快轮拉坯成型，烧成后渗碳工艺使胎体呈现深邃的黑色。此类杯非日常用具，多出于大型墓葬，很可能是身份与祭祀场合的专属器物。它是"最早的中国黑"的代表。',
    light:'最值得记住的是：0.3毫米的杯壁，四千年前的极限手艺。',
    related:['E10','E11','E12'] },
  { id:'E10', title:'红陶兽形壶', kind:'beast', period:'大汶口文化（约前4000年）', gallery:'g_ceramic', x:318, y:166,
    topic:'life', priority:2, stay:3, difficulty:1, source:'public',
    short:'一只憨态可掬的小猪形状的红陶水壶，六千年前的生活幽默感。',
    insight:'实用的注水壶被捏成了小猪的样子——先民也懂得把日子过得可爱一点。',
    detail:'红陶兽形壶1959年出土于泰安大汶口遗址，塑成昂首拱嘴的兽形，背部设注水口，可从兽嘴出水。猪在新石器时代是财富与家养的象征，把它做成器物，既有观察生活的写实力，也有朴素的祈富之意。它是大汶口文化陶塑艺术的代表作。',
    light:'最值得记住的是：六千年前的水壶做成了小猪，实用又可爱。',
    related:['E09','E11','E26'] },
  { id:'E11', title:'白陶鬶', kind:'li', period:'龙山文化', gallery:'g_ceramic', x:318, y:214,
    topic:'life', priority:1, stay:2, difficulty:1, source:'demo',
    short:'鸟喙状流的白陶温酒器，三条袋足可以直接架火烧煮。',
    insight:'鬶的造型像一只引颈的鸟——东夷族群或许正以鸟为图腾。',
    detail:'鬶是大汶口—龙山文化特有的器类，颈口捏出上扬的流，三个袋足扩大受热面积，可直接温煮。白色来自高岭土类的原料，是后来瓷器的物质基础之一。鸟形的流颈让不少学者联想到东方部族的鸟崇拜传统。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：鬶像一只鸟，白陶原料已接近瓷土。',
    related:['E09','E10','E12'] },
  { id:'E12', title:'彩陶罐（大汶口类型）', kind:'pen', period:'大汶口文化', gallery:'g_ceramic', x:318, y:246,
    topic:'ceramic', priority:1, stay:2, difficulty:1, source:'demo',
    short:'施红白彩绘的储藏陶罐。',
    insight:'吃饱之后，人们开始在意"好看"——文明往往从一道花纹开始。',
    detail:'大汶口文化的彩陶以红衣、黑白复彩为特色，常见三角纹、波浪纹与八角星纹。彩绘在陶坯阶段完成入窑烧成，颜色经久不褪。储藏罐上的图案除装饰外，也可能承载族群的记号系统。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：彩陶的花纹可能是最早的"群体记号"。',
    related:['E09','E11','E17'] },

  /* ---------- 考古山东 ---------- */
  { id:'E13', title:'银雀山汉简《孙子兵法》', kind:'slips', period:'西汉', gallery:'g_arch', x:70, y:486,
    topic:'war', priority:3, stay:5, difficulty:2, source:'public',
    short:'两千年前手写的竹简兵书，《孙子兵法》现存最早的实物文本之一。',
    insight:'失传千年的《孙膑兵法》与《孙子兵法》同穴而出，一段学术悬案就此了结。',
    detail:'1972年临沂银雀山一号汉墓出土竹简四千九百余枚，其中《孙子兵法》十三篇与久已亡佚的《孙膑兵法》同出，证实两部兵书各自成书、各有其人，澄清了唐代以来的疑古之争。简文墨迹为西汉初期隶书，笔画率意而结体已趋方正。《孙子兵法》"知彼知己，百战不殆"的原句就写在这些窄窄的竹片上。它是二十世纪中国最重要的简牍发现之一。',
    light:'最值得记住的是：《孙子》与《孙膑》同墓出土，解开千年谜案。',
    related:['E14','E15','E18'] },
  { id:'E14', title:'商代刻辞卜骨', kind:'bone', period:'商代', gallery:'g_arch', x:140, y:486,
    topic:'text', priority:2, stay:3, difficulty:2, source:'demo',
    short:'钻凿灼烧过的牛肩胛骨，上面契刻着占卜文字。',
    insight:'这些刻痕是中国最早的成熟文字现场——问的问题大多是"明天会不会下雨"。',
    detail:'商人凡事占卜：征伐、田猎、收成、天气乃至梦境。贞人将甲骨钻凿灼烧，据裂纹走向判读吉凶，再把卜问与结果刻在旁边，形成卜辞。一条完整卜辞包括前辞、命辞、占辞、验辞，已是非常成熟的记事结构。汉字三千多年未曾中断的历史，就从这样的刻痕里延续下来。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：甲骨文记录的多是日常疑问，而非神秘预言。',
    related:['E13','E15','E08'] },
  { id:'E15', title:'战国铭文铜戈', kind:'sword', period:'战国', gallery:'g_arch', x:70, y:520,
    topic:'war', priority:1, stay:2, difficulty:1, source:'demo',
    short:'带铭文的青铜戈，车战时代的标准兵器。',
    insight:'戈是"干戈"的那个戈——汉字里几乎所有打仗的字，都带着它的影子。',
    detail:'戈由横装的援、内与柲构成，勾啄为主、兼可推割，是商周车战的骨干兵器。铭文多记工官与督造者，形成"物勒工名"的责任制度——兵器质量不合格可以追到人。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是："大动干戈"的戈，是车战时代的标配。',
    related:['E13','E01','E16'] },
  { id:'E16', title:'汉代铁剑与甲片', kind:'sword', period:'汉', gallery:'g_arch', x:140, y:520,
    topic:'war', priority:1, stay:2, difficulty:1, source:'demo',
    short:'锻制长铁剑与皮甲缀连的铁甲片。',
    insight:'铁器登场，青铜兵器退场——材料的一次换代，改写了战争的全部规则。',
    detail:'汉代冶铁技术成熟，炒钢与百炼钢使剑身更长且坚韧，骑兵冲击战术随之兴起。甲片以麻绳编缀于皮革或织物衬底，防护与机动并重。冷兵器从青铜到铁的转变，与中央集权的武备体系同步完成。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：铁剑替代铜兵器，战争进入新材料时代。',
    related:['E15','E13','E17'] },

  /* ---------- 汉代画像 ---------- */
  { id:'E17', title:'东平汉墓壁画', kind:'mural', period:'西汉末', gallery:'g_han', x:70, y:332,
    topic:'hanart', priority:2, stay:4, difficulty:2, source:'public',
    short:'保存完好的墓室壁画，两千年前山东人的衣食起居直接画在墙上。',
    insight:'这不是神仙世界，是真实的人间——拜谒、宴饮、斗鸡走狗，全是生活本身。',
    detail:'2007年发掘的东平后屯汉代壁画墓，墓室顶部绘云气与日月，门楣、四壁绘拜谒图、宴饮图、斗鸡图与方相氏驱邪等场景。人物以墨线勾勒再施色彩，仪态生动，是山东地区迄今发现最早的墓室壁画实物。画面里的盘盏、几案、衣冠服饰，为研究汉代生活提供了图像证据。',
    light:'最值得记住的是：壁画画的不是神话，是汉代人自己的日子。',
    related:['E18','E20','E12'] },
  { id:'E18', title:'孔子见老子画像石', kind:'mural', period:'东汉', gallery:'g_han', x:150, y:332,
    topic:'hanart', priority:2, stay:4, difficulty:2, source:'public',
    short:'石头上的历史性会面：两位圣人拱手相对，中间还有个七岁的项橐。',
    insight:'汉代人把"孔子向老子问礼"刻在墓室里——这是他们心中最值得带走的知识时刻。',
    detail:'"孔子见老子"是东汉画像石的流行题材，多表现孔子携弟子拜见老子、问礼于斯的场景，画面常间以童子项橐。这一题材既是历史记忆的图像化，也反映汉代尊崇师承与学问的风气。对参观者而言，它是展厅里离"儒家源头"最近的一块石头。',
    light:'最值得记住的是：汉代人认为最该记住的画面，就是两位圣人互相行礼。',
    related:['E13','E02','E17'] },
  { id:'E19', title:'车马出行画像石', kind:'mural', period:'东汉', gallery:'g_han', x:70, y:388,
    topic:'life', priority:1, stay:2, difficulty:1, source:'demo',
    short:'长卷式的车马队列，刻画墓主人出行仪仗。',
    insight:'车队有几辆车、什么规格，等于汉代版的"名片"。',
    detail:'车马出行图是汉画像石的经典构图：导骑、轺车、斧车、从骑依次排开，车盖的高低与骑从的数量都有制度含义。画面采用散点透视，马匹腾跃的姿态极富动势。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：出行车队的规模=身份说明书。',
    related:['E17','E20','E24'] },
  { id:'E20', title:'庖厨图画像石', kind:'mural', period:'东汉', gallery:'g_han', x:150, y:388,
    topic:'life', priority:1, stay:2, difficulty:1, source:'demo',
    short:'一幅热闹的后厨全景：宰牲、汲水、蒸烤、端盘。',
    insight:'想穿越回汉代吃顿饭？这块石头上有完整的菜单流程图。',
    detail:'庖厨图集中表现备餐场景：悬挂的鱼禽、灶台上的甑釜、烤炉旁执扇的厨师，细节密不透风。它与宴饮图常常配套出现，共同构成汉代人对"丰足"的想象。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：汉代后厨的全流程，都刻在这一块石头上。',
    related:['E17','E19','E10'] },

  /* ---------- 佛教造像 ---------- */
  { id:'E21', title:'蝉冠菩萨像', kind:'buddha', period:'东魏', gallery:'g_buddha', x:292, y:336,
    topic:'buddha', priority:2, stay:3, difficulty:2, source:'public',
    short:'头戴蝉纹宝冠的石雕菩萨，衣纹贴体如出水，流失海外十四年后回归。',
    insight:"冠上的蝉纹极为罕见——蝉蜕重生，恰好呼应了佛教关于超越生死的比喻。",
    detail:'蝉冠菩萨像1976年出土于博兴县龙华寺遗址，菩萨宝冠正中雕刻蝉纹，同类形象在国内存世极少。造像身躯修长，帔帛交叉，衣褶呈阶梯状层层垂落，体现北朝晚期青州风格石雕的典雅气质。此像曾流失海外，历经波折于二十一世纪初回归，入藏山东博物馆，是文物追索返还的标志性案例。',
    light:'最值得记住的是：冠上蝉纹=蜕变与重生，罕见的佛教意象。',
    related:['E22','E23','E09'] },
  { id:'E22', title:'贴金彩绘佛立像', kind:'buddha', period:'北朝', gallery:'g_buddha', x:292, y:388,
    topic:'buddha', priority:1, stay:3, difficulty:2, source:'demo',
    short:'残存贴金与彩绘的立佛像，袈裟轻薄贴体。',
    insight:'曹衣出水的意思就在眼前——衣服像刚从水里出来一样贴在身上。',
    detail:'北朝晚期山东地区造像受南朝画风影响，佛衣渐趋单薄贴体，躯体轮廓隐现，表面残留朱砂、石绿与金箔痕迹。原本浓丽的妆彩提醒我们：石窟与造像当年并非素雅灰石，而是金碧辉煌的。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：造像当年是贴金彩绘的，不是灰色石头。',
    related:['E21','E23','E17'] },
  { id:'E23', title:'石雕背屏三尊像', kind:'buddha', period:'北魏—东魏', gallery:'g_buddha', x:330, y:362,
    topic:'buddha', priority:1, stay:2, difficulty:1, source:'demo',
    short:'一铺三尊的背屏式造像，飞天与龙衔莲点缀四周。',
    insight:'一块石头上同时出现佛、菩萨、飞天与龙——信仰世界的"全家福"。',
    detail:'背屏式三尊像是青州风格的典型形制：主尊与二胁侍立于莲台，背后舟形背屏上浮雕飞天托塔，底部龙口衔莲承托胁侍。造像题记多记邑社信众集资造像祈福，是社会性信仰活动的见证。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：一铺造像就是一个完整的信仰宇宙。',
    related:['E21','E22','E18'] },

  /* ---------- 明代鲁王 ---------- */
  { id:'E24', title:'九旒冕', kind:'crown', period:'明洪武年间', gallery:'g_luwang', x:262, y:486,
    topic:'life', priority:2, stay:3, difficulty:2, source:'public',
    short:'现存唯一的明代亲王冕冠实物流传至今。',
    insight:'冠前后垂下的玉珠叫"旒"——挡住视线，意思是王者"视而不见不该看的"',
    detail:'九旒冕出自邹城明鲁荒王朱檀墓，藤篾胎髹黑漆，冠前后各垂九旒，以五色玉珠穿成，与《明史·舆服志》所载亲王冠制相合。"旒蔽明、黈纩塞耳"的古义，象征君主对琐细之事有所不视不听。作为中国现存唯一完整的明代亲王冕服实物，它是衣冠制度研究的孤本级材料。',
    light:'最值得记住的是：冕上的玉旒故意遮挡视线，象征君主的克制。',
    related:['E25','E26','E19'] },
  { id:'E25', title:'戗金云龙纹木匣', kind:'box', period:'明初', gallery:'g_luwang', x:330, y:486,
    topic:'life', priority:1, stay:2, difficulty:1, source:'demo',
    short:'朱漆地戗金云龙纹的随葬木匣，工艺精细。',
    insight:'在漆面上针刻细槽再填金粉，叫"戗金"——明代皇家的奢侈品工艺。',
    detail:'戗金属于漆器装饰中的刻填类工艺，以特制针刀在漆面勾划出纤细纹理，填入金胶漆与金箔粉。云龙纹为皇家专用题材，规制森严。鲁王墓中此类漆木器保存状况良好，可见明初亲王府用度之一斑。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：戗金=漆上刻纹填金，皇家限定工艺。',
    related:['E24','E26','E07'] },
  { id:'E26', title:'织金袍料（残片）', kind:'cloth', period:'明初', gallery:'g_luwang', x:296, y:522,
    topic:'life', priority:1, stay:2, difficulty:1, source:'demo',
    short:'织入金线的丝织袍料残片。',
    insight:'金线不是绣上去的，是直接织进缎纹里的——一寸织物一寸金。',
    detail:'织金锦以捻金线作纹纬，与彩色丝线交织显花，元代称"纳石矢"，明代宫廷织染局续有生产。鲁王墓出土织物虽残，组织结构与配色仍清晰可辨。（本条目为 Demo 模拟内容。）',
    light:'最值得记住的是：金线是织进去的，不是绣上去的。',
    related:['E24','E25','E19'] }
];

/* 快捷索引 */
window.EX_INDEX = {};
EXHIBITS.forEach(function (e) { EX_INDEX[e.id] = e; });

/* ============================================================
   P1-1 知识库富化层：keywords/themes/people/concepts/relatedQuestions
   P1-5 来源审计层：sourceType/sourceTitle/sourceUrl
   通过 ENRICH 表统一注入，未覆盖字段使用安全默认值。
   sourceType 取值：'public_site'(公开资料整理) | 'demo'(Demo模拟内容)
   ============================================================ */
window.EX_ENRICH = {
  E01: { keywords:['钺','亚醜','苏埠屯','军权','人面纹','方国'], themes:['权力与身份','商代方国'], people:[], concepts:['礼器制度','军事统帅权','透雕'],
    relatedQuestions:['钺真的用来打仗吗？','亚醜是谁？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·馆藏珍品（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E02: { keywords:['簋','册命','铭文','鼎簋组合','列鼎制度'], themes:['礼乐制度','家族记忆'], people:['颂（西周贵族）'], concepts:['礼器等级','册命典礼','金文'],
    relatedQuestions:['九鼎八簋是什么规格？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·镇馆之宝（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E03: { keywords:['爵','温酒','祭祀','云雷纹','酒器'], themes:['商人尚酒'], people:[], concepts:['祭祀礼仪','纹饰程式'], relatedQuestions:['爵的柱子是做什么的？'] },
  E04: { keywords:['鼎','兽面纹','饕餮','问鼎','炊器'], themes:['权力象征'], people:['楚庄王（典故）'], concepts:['国之大器','礼器核心'], relatedQuestions:['鼎为什么会成为国家象征？'] },
  E05: { keywords:['觥','夔龙纹','宴饮','兽形器'], themes:['宴饮文化'], people:[], concepts:['觥筹交错','肖生器物'], relatedQuestions:['觥筹交错说的是它吗？'] },
  E06: { keywords:['编钟','钮钟','音律','双音钟','礼乐'], themes:['礼乐制度'], people:[], concepts:['一钟双音','钟鸣鼎食'], relatedQuestions:['编钟怎么敲出两个音？'] },
  E07: { keywords:['错金银','金银丝','战国工艺','流云纹'], themes:['装饰工艺巅峰'], people:[], concepts:['错金工艺'], relatedQuestions:['错金是怎么做上去的？'] },
  E08: { keywords:['铜镜','铭文镜','山字纹','规矩纹','祝愿'], themes:['日常生活'], people:[], concepts:['镜铭文化'], relatedQuestions:['古人用什么照镜子？'] },
  E09: { keywords:['蛋壳陶','黑陶','龙山文化','快轮制陶','高柄杯'], themes:['史前技术巅峰'], people:[], concepts:['渗碳工艺','轮制法'], relatedQuestions:['0.3毫米是怎么做到的？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·镇馆之宝（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E10: { keywords:['红陶','兽形壶','大汶口','陶塑','小猪'], themes:['生活情趣','家畜驯养'], people:[], concepts:['图腾与财富'], relatedQuestions:['为什么做成小猪？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·馆藏珍品（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E11: { keywords:['鬶','白陶','袋足','鸟形','高岭土'], themes:['东夷鸟崇拜'], people:[], concepts:['白陶与瓷土'], relatedQuestions:['鬶和鸟有什么关系？'] },
  E12: { keywords:['彩陶','大汶口','八角星纹','复彩'], themes:['原始审美'], people:[], concepts:['族群记号'], relatedQuestions:['彩绘为什么不掉色？'] },
  E13: { keywords:['孙子兵法','孙膑兵法','银雀山','竹简','汉简','兵书','隶书'], themes:['兵学源头','早期书写'], people:['孙子（孙武）','孙膑','汉墓墓主'], concepts:['疑古与出土文献','简牍制度'], relatedQuestions:['竹简怎么保存两千年？','孙子和孙膑是同一个人吗？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·银雀山汉简（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E14: { keywords:['甲骨','卜骨','占卜','贞人','契刻','商代文字'], themes:['文字起源'], people:['贞人'], concepts:['卜辞结构','汉字之源'], relatedQuestions:['甲骨文都问些什么？'] },
  E15: { keywords:['戈','车战','铭文','物勒工名','勾啄'], themes:['车战时代'], people:[], concepts:['兵器责任制度'], relatedQuestions:['戈怎么用？'] },
  E16: { keywords:['铁剑','甲片','炒钢','骑兵','百炼钢'], themes:['铁器革命'], people:[], concepts:['冶铁技术'], relatedQuestions:['铁剑比铜剑强在哪？'] },
  E17: { keywords:['墓室壁画','东平','宴饮图','拜谒图','斗鸡'], themes:['汉代生活图像'], people:[], concepts:['壁画墓制度'], relatedQuestions:['汉代人吃什么？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·东平汉墓壁画（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E18: { keywords:['孔子','老子','项橐','问礼','画像石','儒家','孔子见老子'], themes:['师承与学问','历史记忆图像化'], people:['孔子','老子','项橐'], concepts:['尊师崇学','汉代儒学'], relatedQuestions:['孔子和老子谁年纪大？','为什么这个题材流行？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·汉画像石（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E19: { keywords:['车马出行','仪仗','轺车','斧车','导骑'], themes:['身份等级'], people:[], concepts:['车服制度'], relatedQuestions:['几辆车算大官？'] },
  E20: { keywords:['庖厨图','灶台','烤串','甑釜','备餐'], themes:['汉代饮食'], people:[], concepts:['宴饮配套图像'], relatedQuestions:['汉代人怎么做饭？'] },
  E21: { keywords:['蝉冠','菩萨','博兴','龙华寺','青州风格','文物回归'], themes:['造像艺术','流失与回归'], people:[], concepts:['蝉纹意象','北朝造像'], relatedQuestions:['蝉冠为什么罕见？','它是怎么回来的？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·蝉冠菩萨像（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E22: { keywords:['贴金','彩绘','佛立像','曹衣出水','袈裟'], themes:['造像艺术'], people:[], concepts:['曹衣出水','妆彩复原'], relatedQuestions:['佛像原本是什么颜色？'] },
  E23: { keywords:['背屏式','三尊像','飞天','龙衔莲','邑社'], themes:['信仰共同体'], people:[], concepts:['青州风格形制'], relatedQuestions:['为什么三尊一起雕？'] },
  E24: { keywords:['冕','九旒','鲁荒王','朱檀','邹城','舆服制度'], themes:['衣冠制度'], people:['朱檀（明鲁荒王）'], concepts:['旒蔽明','亲王礼制'], relatedQuestions:['旒为什么要挡住眼睛？'], sourceType:'public_site', sourceTitle:'山东博物馆官网·明代鲁王展（公开资料整理）', sourceUrl:'https://www.sdmuseum.com/' },
  E25: { keywords:['戗金','漆器','云龙纹','木匣'], themes:['皇家工艺'], people:[], concepts:['戗金工艺'], relatedQuestions:['戗金和描金有什么区别？'] },
  E26: { keywords:['织金','纳石矢','袍料','捻金线'], themes:['纺织技艺'], people:[], concepts:['织金锦'], relatedQuestions:['金线怎么织进去的？'] }
};
EXHIBITS.forEach(function (e) {
  var n = EX_ENRICH[e.id] || {};
  e.keywords = n.keywords || [];
  e.themes = n.themes || [];
  e.people = n.people || [];
  e.concepts = n.concepts || [];
  e.relatedQuestions = n.relatedQuestions || [];
  e.sourceType = n.sourceType || 'demo';
  e.sourceTitle = e.sourceType === 'demo'
    ? 'Demo 模拟内容（演示用，非馆方资料）'
    : (n.sourceTitle || '公开资料整理');
  e.sourceUrl = e.sourceType === 'demo' ? '' : (n.sourceUrl || '');
});

/* 文创补充：关联主题名（用于解释"为什么与你有关"） */
MUSEUMS.sdm.products.forEach(function (p) {
  p.relatedTopicNames = p.topics.map(function (t) {
    return MUSEUMS.sdm.topics[t] ? MUSEUMS.sdm.topics[t].name : t;
  });
});

/* 默认初始路线（第一次来 / 90分钟 / 慢慢看 / 青铜器） */
window.DEFAULT_ROUTE = ['E01','E02','E03','E04','E05','E07','E09','E13'];

/* 兴趣种子映射 */
window.INTEREST_SEEDS = {
  '青铜': 'bronze', '青铜器': 'bronze', '鼎': 'bronze', '礼器': 'bronze',
  '陶瓷': 'ceramic', '陶器': 'ceramic', '瓷器': 'ceramic', '蛋壳': 'ceramic',
  '佛教': 'buddha', '造像': 'buddha', '菩萨': 'buddha',
  '画像': 'hanart', '汉代': 'hanart', '壁画': 'hanart',
  '兵法': 'war', '战争': 'war', '兵器': 'war', '孙子': 'war',
  '文字': 'text', '甲骨': 'text', '简牍': 'text', '书法': 'text',
  '生活': 'life', '日常': 'life'
};
