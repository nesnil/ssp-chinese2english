#!/usr/bin/env python3
from pathlib import Path
import re

base = Path('/Users/linsen/projects/c2e/result/s2_days')

DATA = {
21: [
("你能用证据证明这个事实吗? (fact)", "Can you prove this fact with evidence?"),
("皮肤白皙的人要保护自己免受晒伤。 (fair)", "People with fair skin need to protect themselves from sunburn."),
("胖乎乎的小狗在院子里玩了一整天。 (fat)", "The fat puppy played around the yard all day."),
("清明节是中国人扫墓祭祖的时候。 (festival)", "The Qingming Festival is a time for Chinese people to sweep tombs and pay respect to ancestors."),
("人们通常会放烟花来庆祝新年。 (firework)", "People usually set off fireworks to celebrate the New Year."),
],
22: [
("房间里充满了刚出炉的面包味道。 (fill)", "The room is filled with the smell of freshly baked bread."),
("老师把手指举到嘴边，示意安静。 (finger)", "The teacher raised her finger to her lips as a sign for silence."),
("渔民耐心地等待着鱼儿上钩。 (fisherman)", "The fisherman waited patiently for the fish to bite."),
("他试图修好电脑，但电脑损坏严重。 (fix)", "He tried to fix the computer, but it was badly damaged."),
("流感会在人群密集的地方迅速传播。 (flu)", "The flu can spread quickly in crowded places."),
],
23: [
("如果你跟着地图走，你很容易就能找到酒店。 (follow)", "If you follow the map, you can find the hotel easily."),
("体育场里挤满了欢呼的人群。 (full)", "The stadium was full of cheering people."),
("在未来，科技将继续发展。 (future)", "In the future, technology will continue to develop."),
("乘客只需8分钟就能走到最远的登机口。 (gate)", "Passengers only need eight minutes to walk to the farthest boarding gate."),
("一般来说，与苦的食物相比，人们更喜欢甜的食物。 (general)", "In general, people tend to prefer sweet foods over bitter ones."),
],
24: [
("我发现当噪音太大时很难集中注意力。 (focus)", "I find it hard to focus when there is too much noise."),
("如果你忘记了密码，可以在这里重置。 (forget)", "If you forget your password, you can reset it here."),
("她在比赛中的出色表现获得了认可。 (gain)", "She gained recognition for her outstanding performance in the match."),
("我的老师有着温和的教学方法，使学习令人愉快。 (gentle)", "My teacher has a gentle way of teaching that makes learning enjoyable."),
("社区计划为无家可归者建造更多庇护所。 (homeless)", "The community plans to build more shelters for the homeless."),
],
25: [
("政府推出了新政策以改善教育。 (government)", "The government has introduced new policies to improve education."),
("随着太阳落山，天空逐渐变得更加昏暗。 (grow)", "As the sun sets, the sky grows darker."),
("毕业典礼将在学校礼堂举行。 (hall)", "The graduation ceremony will take place in the school hall."),
("我讨厌别人在我说话时打断我。 (hate)", "I hate it when people interrupt me when I'm speaking."),
("我们要在高温时多喝水以保持凉爽。 (heat)", "We need to drink plenty of water to stay cool in the heat."),
],
26: [
("告别时他们紧紧地拥抱了对方。 (hug)", "They hugged each other tightly as they said goodbye."),
("这部电影探讨了人与自然的关系。 (human)", "This movie explored the relationship between humans and nature."),
("上了一节美术课后，我对绘画产生了兴趣。 (interested)", "I became interested in painting after taking an art class."),
("我们决定采访几位该领域的专家。 (interview)", "We decided to interview several experts in this field."),
("这座岛是一个完美的度假胜地。 (island)", "This island is a perfect vacation destination."),
],
27: [
("当温度达到沸点时，水就开始冒蒸汽。 (hit)", "When the temperature hits the boiling point, the water starts to steam."),
("为了提高自己，这个夏天我要开始培养下棋这样的爱好。 (hobby)", "To improve myself, I will take up a hobby like playing chess this summer."),
("我们希望能为我们的项目获取足够的支持。 (hope)", "We hope to gather enough support for our project."),
("主持人宣布了比赛的获胜者。 (host)", "The host announced the winner of the competition."),
("然而，结果却出乎所有人的意料。 (however)", "However, the result was surprising to everyone."),
],
28: [
("保险柜的钥匙藏在一本书里。 (key)", "The key to the safe is hidden in a book."),
("受污染的空气和水可以杀死植物、动物，甚至人。 (kill)", "Polluted air and water can kill plants, animals, and even people."),
("那位女士在会议上发表了精彩的演讲。 (lady)", "That lady gave a wonderful speech at the conference."),
("这片土地是很多不同种类植物的家园。 (land)", "This land is home to many different species of plants."),
("互联网使得学习新语言变得更加容易。 (language)", "The internet has made it easier to learn new languages."),
],
29: [
("这座建筑非常巨大，从几英里外就能看到。 (huge)", "The building is so huge that it can be seen from miles away."),
("尊重他人的观点很重要，即便我们不同意他们的观点。 (important)", "It is important to respect other people's opinions, even if we don't agree with them."),
("为了提高顾客满意度，餐厅改进了服务。 (increase)", "To increase customer satisfaction, the restaurant improved its service."),
("请在进入室内游乐场前把鞋脱掉。 (indoor)", "Please remove your shoes before entering the indoor playground."),
("让我们在互联网上查找更多有关中国传统艺术的信息。 (information)", "Let's find out more information about Chinese traditional art on the internet."),
],
30: [
("确保在讲座期间做详细的笔记。 (lecture)", "Make sure to take detailed notes during the lecture."),
("如果你把伞借给我，雨一停我就会把它还给你。 (lend)", "If you lend me your umbrella, I will return it to you as soon as the rain stops."),
("图书管理员为我的暑期阅读书单推荐了几本小说。 (librarian)", "The librarian recommended several novels for my summer reading list."),
("侦探找到了证明嫌疑人说谎的证据。 (lie)", "The detective found evidence that proved the suspect told a lie."),
("你能帮我把这个重箱子抬到架子上吗? (lift)", "Can you help me lift this heavy box onto the shelf?"),
],
31: [
("上海近年来举办了许多国际会议。 (international)", "Shanghai has hosted many international conferences in recent years."),
("我们的挑战是要发明一种满足客户需求的产品。 (invent)", "Our challenge is to invent a product that meets the needs of customers."),
("纸是中国古代四大发明之一。 (invention)", "Paper is among the four great inventions in ancient China."),
("这位发明家因其对现代科技的贡献而受到表彰。 (inventor)", "This inventor was honored for his contributions to modern technology."),
("她决定这个周末邀请朋友们来吃晚餐。 (invite)", "She decided to invite her friends over for dinner this weekend."),
],
32: [
("把液体巧克力倒在蛋糕上。 (liquid)", "Pour the liquid chocolate over the cake."),
("在没有任何指导的情况下学习新软件时，我感到迷茫。 (lost)", "I felt lost while learning the new software without any guidance."),
("每个人都会犯错误，但我们如何处理错误才是重要的。 (mistake)", "Everyone makes mistakes, but it's how we handle them that matters."),
("附近的运动场可供社区活动使用。 (nearby)", "The nearby sports field is available for community events."),
("展览中有来自近50个国家的800多件民间艺术作品。 (nearly)", "There were more than 800 pieces of folk art from nearly 50 countries in the exhibition."),
],
33: [
("我收藏的每一件物品都有自己的历史。 (item)", "Each item in my collection has its own history."),
("我上个月买的牛仔裤现在正在打折。 (jeans)", "The jeans I bought last month are on sale now."),
("听到这个笑话时，她情不自禁地笑了起来。 (laugh)", "She couldn't help laughing when she heard the joke."),
("我要尽快离开去赶飞机。 (leave)", "I need to leave soon to catch my flight."),
("因为气候变化，所以海平面正在上升。 (level)", "The sea level is going up because of climate change."),
],
34: [
("我在节日期间常常和邻居交换小礼物。 (neighbour)", "I often exchange small gifts with my neighbour during holidays."),
("花园周围的网可以防止动物进入。 (net)", "The net around the garden prevents animals from getting in."),
("未经允许，任何人不得进入这个区域。 (nobody)", "Nobody is allowed to enter this area without permission."),
("我想对你的成功表示祝贺。 (offer)", "I would like to offer my congratulations on your success."),
("她用植物和家人的照片装饰了办公室。 (office)", "She decorated her office with plants and family photos."),
],
35: [
("电梯出故障了，所以我们只能步行上楼。 (lift)", "The lift is out of order, so we have to walk upstairs."),
("他在纸上画了一条线来标记边界。 (line)", "He drew a line on the paper to mark the boundary."),
("这个标识提醒游客要保持该地区干净，不要乱扔垃圾。 (litter)", "The sign reminds visitors to keep the area clean and not to litter."),
("地图显示了我要去的地方的确切位置。 (location)", "The map shows the exact location of the place where I'm going."),
("如果你不快些行动，你可能会失去机会。 (lose)", "You might lose your chance if you don't act quickly."),
],
36: [
("一旦你学会了基础知识，你就可以轻松提高你的技能。 (learn)", "Once you have learned the basics, you can easily improve your skills."),
("病了一个星期后，这孩子看起来苍白而虚弱。 (pale)", "The child looked pale and weak after being sick for a week."),
("公司的利润今年增长了20%。 (percent)", "The company's profits increased by twenty percent this year."),
("也许这本书能为你的学习提供一些有用的方法。 (perhaps)", "Perhaps this book will provide you with some useful ways for your study."),
("她吃了一片药来缓解头痛。 (pill)", "She took a pill to relieve her headache."),
],
37: [
("这些产品的价格和其他品牌相比相当低。 (low)", "The prices of these products are quite low compared to other brands."),
("红色在中国文化中代表幸运和好运。 (luck)", "Red represents luck and good fortune in Chinese culture."),
("我认为自己很幸运，能遇到这么多有趣的朋友。 (lucky)", "I consider myself lucky to have met so many interesting friends."),
("别忘了在日历上标记下个月的音乐会。 (mark)", "Don't forget to mark your calendar for the concert next month."),
("一顿传统的中餐通常包括米饭。 (meal)", "A traditional Chinese meal often includes rice."),
],
38: [
("钓鱼竿太重了，孩子举不起来。 (pole)", "The fishing pole was too heavy for the kid to lift."),
("野火会产生大量的烟雾，这会污染空气。 (pollute)", "Wildfires can cause a lot of smoke, which will pollute the air."),
("救生员负责确保游泳池内每个人的安全。 (pool)", "The lifeguard is responsible for ensuring the safety of everyone at the swimming pool."),
("学校提供各种课程，让学生练习不同的技能。 (practise)", "The school offers various classes where students can practise different skills."),
("在展览会上，许多人前来称赞这位艺术家的画作。 (praise)", "At the exhibition, many people came to praise the artist's paintings."),
],
39: [
("我不是故意打破花瓶的。 (mean)", "I didn't mean to break the vase."),
("这种药的副作用可能很严重。 (medicine)", "The side effects of this medicine can be serious."),
("小心不要搞混了你电脑上的文件。 (mix)", "Be careful not to mix up the files on your computer."),
("什么样的品质能使某人成为好榜样? (model)", "What qualities make someone a good role model?"),
("我们街区有很多餐馆可以选择。 (neighbourhood)", "There are many restaurants in our neighbourhood to choose from."),
],
40: [
("这部纪录片展示了这座城市的历史。 (present)", "The documentary presents the history of this city."),
("我发现用一门新语言正确发音单词很有挑战。 (pronounce)", "I find it challenging to pronounce words in a language properly."),
("如果你不正确地遵守安全规则，你可能会受伤。 (properly)", "If you don't follow the safety rules properly, you might get injured."),
("这一段落的目的是要求人们停止浪费食物。 (purpose)", "The purpose of the passage is to ask people to stop wasting food."),
("要实现目标，就必须突破你自己的舒适区。 (push)", "To achieve your goals, you must push yourself beyond your comfort zone."),
],
}

for day, items in DATA.items():
    lines = [f"### Day{day}", ""]
    for i, (q, a) in enumerate(items, 1):
        lines.append(f"{i}. {q}")
        lines.append(f"  - {a}")
    (base / f"Day{day}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

all_files = sorted(base.glob('Day*.md'), key=lambda p: int(re.search(r'Day(\d+)', p.name).group(1)))
blocks = [f.read_text(encoding='utf-8').strip() for f in all_files]
Path('/Users/linsen/projects/c2e/result/C2E-S2.md').write_text("\n\n".join(blocks)+"\n", encoding='utf-8')
print('updated Day21-40 and merged C2E-S2.md')
