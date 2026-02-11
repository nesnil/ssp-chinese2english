#!/usr/bin/env python3
from pathlib import Path
import re

base = Path('/Users/linsen/projects/c2e/result/s2_days')

DATA = {
41: [
("新闻如何影响人们对社会问题的看法? (news)", "How does the news affect people's opinions on social issues?"),
("北极以其极端寒冷的气温而闻名。 (north)", "The North Pole is known for its extreme cold temperatures."),
("你注意到今天天气变化得有多快吗? (notice)", "Did you notice how quickly the weather changed today?"),
("关于这个主题已经做了大量的研究。 (number)", "A large number of studies have been done on this topic."),
("学校为学生们组织了一次去博物馆的郊游。 (outing)", "The school organized an outing to the museum for the students."),
],
42: [
("火势迅速蔓延，但消防员及时赶到了。 (quickly)", "The fire spread quickly, but the firemen arrived on time."),
("政府计划提高税收以改善公共服务。 (raise)", "The government plans to raise taxes to improve public services."),
("我们终于到家时已经比较晚了。 (rather)", "It was rather late when we finally got home."),
("我过了一会儿才意识到我把钱包忘在家里了。 (realise)", "It took me a while to realise that I had left my wallet at home."),
("他们齐心协力重建被毁坏的道路。 (rebuild)", "They worked together to rebuild the damaged road."),
],
43: [
("肩膀的疼痛已经困扰我好几天了。 (pain)", "The pain in my shoulder has been bothering me for days."),
("我们需要一个可靠的搭档来开展这一重要的研究项目。 (partner)", "We need a reliable partner for this important research project."),
("握手是传染疾病的主要方式之一。 (pass)", "Shaking hands is one of the major ways to pass on diseases."),
("海关人员检查了旅客的护照和行李。 (passenger)", "Customs officers checked the passengers' passports and luggage."),
("这个故事告诫我们，我们可能会为自己的错误决定付出代价。 (pay)", "The story warns us that we may pay the price for our bad decisions."),
],
44: [
("你应该学会放松，不要给自己太大的压力。 (relax)", "You should learn to relax and not to put so much pressure on yourself."),
("该项目要求团队成员之间的密切合作。 (require)", "The project requires close cooperation among team members."),
("很多年轻人喜欢摇滚乐及其叛逆精神。 (rock)", "Many young people like rock music and its rebellious spirit."),
("通过研究树根，我们能了解这棵树的年龄。 (root)", "By studying the roots of a tree, we can learn about its age."),
("他粗鲁的行为给大家留下了坏印象。 (rude)", "His rude behaviour left a bad impression on everyone."),
],
45: [
("尊重他人的人通常也会受到他人的尊重。 (person)", "A person who respects others is usually respected by others."),
("请捡起垃圾并把它扔进合适的垃圾桶里。 (pick)", "Please pick up the rubbish and put it into the proper rubbish bin."),
("出乎我们意料的是，公园里挤满了野餐的人。 (picnic)", "To our surprise, the park was crowded with people having picnics."),
("我们的太阳系由包括地球在内的八颗行星组成。 (planet)", "Our solar system consists of eight planets including Earth."),
("许多国家正在采取行动减少塑料污染。 (plastic)", "Many countries are taking action to reduce plastic pollution."),
],
46: [
("商店经理重新摆放了货架以吸引更多顾客。 (shelf)", "The store manager rearranged the shelves to attract more customers."),
("我常常羞于表达自己的观点。 (shy)", "I am often shy about expressing my opinions."),
("他在整个会议期间保持沉默。 (silent)", "He remained silent throughout the meeting."),
("我们应该尽快改善环境状况。 (situation)", "We should improve the environmental situation as soon as possible."),
("一架飞机飞过天空，留下了长长的尾迹。 (sky)", "A plane flew through the sky, leaving a long trail behind."),
],
47: [
("公司愿意为新员工的发展提供平台。 (platform)", "The company is willing to provide a platform for the development of new employees."),
("这首诗描绘了一幅宁静的乡村生活场景。 (poem)", "The poem describes a peaceful scene of rural life."),
("政府为贫困地区的学生提供了一些新的计算机设备。 (poor)", "The government provided students in poor areas with some new computer equipment."),
("图书馆张贴了有关新借书系统的公告。 (post)", "The library posted an announcement about the new book-lending system."),
("发电站为整个城市提供电力。 (power)", "The power station provides electricity for the whole city."),
],
48: [
("花瓶里的花闻起来没有昨天那么香了。 (smell)", "The flowers in the vase don't smell as sweet as they did yesterday."),
("社交媒体改变了人们相互沟通的方式。 (social)", "Social media has changed the way people communicate with each other."),
("柔和的音乐让气氛更加轻松。 (soft)", "The soft music made the atmosphere more relaxing."),
("这次演讲太有力量了，每个人都被深深感动。 (speech)", "The speech was so powerful that everyone was deeply touched."),
("背景中奇怪的声响打断了他们的谈话。 (strange)", "The strange noise in the background interrupted their conversation."),
],
49: [
("这个电视节目很好，让公众养成了阅读的习惯。 (programme)", "It's a great TV programme that brings the habit of reading back into the public."),
("为了防止疾病传播，所有公共服务必须关闭。 (public)", "In order to prevent the illness from spreading, all public services must be shut down."),
("作者正致力于在今年出版她的第二部小说。 (publish)", "The author is working on publishing her second novel this year."),
("这个问题与我们上周解决的问题很相似。 (quite)", "This problem is quite similar to the one we solved last week."),
("我们需要在这个问题上达成共识。 (reach)", "We need to reach a consensus on this issue."),
],
50: [
("我正在睡觉，闹钟突然响了。 (suddenly)", "I was sleeping when the alarm clock suddenly went off."),
("很多人在春季会遭受过敏的困扰。 (suffer)", "Many people suffer from allergies during the spring season."),
("我不确定我的建议是否对你有帮助。 (suggestion)", "I am not sure if my suggestion is helpful to you."),
("地球表面近四分之三被水覆盖。 (surface)", "Nearly three quarters of the Earth's surface is covered by water."),
("调查询问了参与者对社交媒体的看法。 (survey)", "The survey asked participants about their opinions on social media."),
],
51: [
("教育的目的是让所有学生为未来做好准备。 (ready)", "The purpose of education is to make all students ready for the future."),
("他在危险面前展现出了真正的勇气。 (real)", "He showed real courage in the face of danger."),
("如今科技发展之快真是令人惊叹。 (really)", "It's really amazing how quickly technology is advancing these days."),
("学生们被要求要记录下他们对实验的观察结果。 (record)", "The students were asked to record their observations of the experiment."),
("回收废物有助于为子孙后代保护自然资源。 (recycle)", "Recycling waste helps conserve natural resources for future generations."),
],
52: [
("他的双眼中充满了悲伤的泪水。 (tear)", "His eyes were full of tears of sadness."),
("她用短信给我发了地址，以防我需要。 (text)", "She texted me the address in case I needed it."),
("我感激你在我整个职业生涯中给予我的支持。 (thankful)", "I am thankful for all the support you have given me throughout my career."),
("北极熊厚厚的皮毛有助于它们在北极保持温暖。 (thick)", "The thick fur of polar bears helps them stay warm in the Arctic."),
("尽管旅途漫长，但目的地值得一去。 (though)", "Though the journey was long, the destination was worth visiting."),
],
53: [
("修车的费用远远高于预期。 (repair)", "The cost of repairing the car was much higher than expected."),
("学校的回收计划着重于纸制品的再利用。 (reuse)", "The school's recycling program focuses on reusing paper products."),
("我们都应该尽一份力来减少我们生产的垃圾数量。 (rubbish)", "We should all do our bit to reduce the amount of rubbish we produce."),
("在图书馆和音乐会中保持安静是一条基本的规则。 (rule)", "It's a general rule to keep quiet in libraries and concerts."),
("人群冲进体育场观看足球比赛。 (rush)", "The crowd rushed into the stadium for the football match."),
],
54: [
("魔术师在绳子上打了一个结。 (tie)", "The magician tied a knot in the rope."),
("杂志封面上的标题吸引了我的注意力。 (title)", "The title on the cover of the magazine caught my attention."),
("他上课时很难理解老师说的话。 (trouble)", "He had trouble understanding what the teacher said in class."),
("重要的是寻求真相，而非相信谣言。 (truth)", "It is important to seek the truth rather than accept rumors."),
("随着年龄的增长，人们遗忘东西是很正常的。 (usual)", "It's usual for people to forget things as they get older."),
],
55: [
("医生们争分夺秒地抢救病人的生命。 (save)", "Doctors were racing against time to save the patient's life."),
("科学家通过观察太阳活动来预测未来的天气变化。 (scientist)", "Scientists predict future weather changes by observing solar activity."),
("他们搜遍了整个城市，也没找到丢失的小猫。 (search)", "They searched the whole city but couldn't find the missing cat."),
("他们为老人保留了专座。 (seat)", "They reserved special seats for the elderly."),
("最近几项研究表明，定期锻炼可以降低患心脏病的风险。 (several)", "Several recent studies have shown that regular exercise can reduce the risk of heart disease."),
],
56: [
("上海以其丰富的文化遗产和各种各样的景点而闻名。 (variety)", "Shanghai is famous for its rich cultural heritage and a variety of attractions."),
("村里的路已经拓宽了，为了更方便车辆通行。 (village)", "The village road has been widened to make it easier for vehicles to pass."),
("西方医学在治疗疾病方面取得了巨大进步。 (western)", "Western medicine has made great progress in treating diseases."),
("数字化工具在教育领域的使用正广泛增长。 (wide)", "The use of digital tools in education is growing widely."),
("徒步旅行者被警告不要接近他们可能遇到的任何野生动物。 (wild)", "The hikers were warned not to approach any wild animals they might encounter."),
],
57: [
("蛋糕被做成了一个心的形状。 (shape)", "The cake was made in the shape of a heart."),
("收容所里生病的动物需要适当的照料。 (sick)", "The sick animals in the shelter needed proper care."),
("自从入夏以来，天气一直相当不稳定。 (since)", "The weather has been quite unstable since the beginning of summer."),
("礼盒的大小与礼物的大小完全匹配。 (size)", "The size of the gift box matches the size of the gift perfectly."),
("我期待在寒假和朋友们一起在湖上滑冰。 (skate)", "I look forward to skating on the lake with my friends during the winter vacation."),
],
58: [
("鸟类的翅膀完美地适应于飞行。 (wing)", "Birds' wings are perfectly adapted for flight."),
("成为真正的赢家并不总是意味着成为第一。 (winner)", "Being a real winner doesn't always mean being the first."),
("制作乐器的木材必须经过精心挑选。 (wood)", "The wood used for making musical instruments must be carefully selected."),
("培养实用的生活技能对学生有益。 (skill)", "Developing practical life skills is beneficial for students."),
("皮疹可能由过敏或感染引起。 (skin)", "Skin rashes can be caused by allergies or infections."),
],
59: [
("智能家居系统让你能远程控制电器。 (smart)", "Smart home systems allow you to control your appliances remotely."),
("尽管困难重重，但她始终保持微笑，积极面对生活。 (smile)", "Despite difficulties, she kept smiling and faced life positively."),
("医生建议他立刻戒烟。 (smoke)", "The doctor advised him to stop smoking immediately."),
("这位士兵的牺牲永远不会被忘记。 (soldier)", "The soldier's sacrifice will never be forgotten."),
("我希望能尽快收到你的回复。 (soon)", "I hope to receive your reply soon."),
],
60: [
("他的建议听起来非常实用，且很有帮助。 (sound)", "His advice sounds very practical and helpful."),
("该国南部的气候与北部大不相同。 (south)", "The climate in the south of this country is quite different from that in the north."),
("中国每个不同的地区都有自己独特的传统艺术形式。 (special)", "Every different part of China has its own special forms of traditional art."),
("熊猫平均每天花12个小时吃竹子。 (spend)", "Pandas spend an average of 12 hours eating bamboo every day."),
("广场上的喷泉是游客拍照的热门地点。 (square)", "The square's fountain is a popular photo spot for tourists."),
],
61: [
("这枚稀有邮票的价格随着时间的推移而上涨。 (stamp)", "The price of this rare stamp has increased over time."),
("公交车站提供有关公交线路的信息。 (station)", "The bus station provides information about bus routes."),
("为了避开麻烦而撒谎，最终会导致更多麻烦。 (stay)", "Lying to stay out of trouble can lead to more trouble in the end."),
("他离实现目标还有很长的路要走。 (still)", "He still has a long way to go before he achieves his goal."),
("这家商店对所有产品都有严格的质量控制流程。 (store)", "The store has a strict quality-control process for all products."),
],
62: [
("火车径直穿过了隧道，没有停下。 (straight)", "The train went straight through the tunnel without stopping."),
("祖冲之不仅在数学上很成功，在天文学上也很成功。 (successful)", "Zu Chongzhi was not only successful in mathematics but also in astronomy."),
("糖有助于减轻药物的苦味。 (sugar)", "Sugar helps to sweeten the bitter taste of medicine."),
("我们应该鼓励孩子们从小就探索他们的才能。 (talent)", "We should encourage children to explore their talents from an early age."),
("实验室里的水龙头需要定期清理。 (tap)", "The tap in the laboratory needs to be cleaned regularly."),
],
63: [
("老师的解释比教科书中的更加清晰。 (than)", "The teacher's explanation is clearer than that in the textbook."),
("我们社区的剧场计划举办一系列戏剧来庆祝节日。 (theatre)", "The theatre in our neighbourhood is planning to host a series of plays to celebrate the festival."),
("乐队正在为今晚的演出排练。 (tonight)", "The band is rehearsing for their performance tonight."),
("牙医小心地检查了病人的牙齿。 (tooth)", "The dentist examined the patient's teeth carefully."),
("尊敬长辈是中国文化中的一个宝贵传统。 (tradition)", "Respecting the elderly is a valuable tradition in Chinese culture."),
],
64: [
("该部落保留了其传统的生活方式，依赖狩猎为生。 (traditional)", "The tribe has preserved its traditional way of life, relying on hunting for sustenance."),
("上海的交通网络变得越来越方便。 (transport)", "The transport network in Shanghai has become more and more convenient."),
("乘地铁是一个节省时间和金钱的好方法。 (underground)", "Taking the underground is a good way to save time and money."),
("军装是荣誉和责任的象征。 (uniform)", "The military uniform is a symbol of honour and duty."),
("她要等到完成工作才离开。 (until)", "She won't leave until she finishes her work."),
],
65: [
("视频一步一步地展示了制作蛋糕的过程。 (video)", "The video showed the process of making a cake step by step."),
("她正在为即将到来的音乐会练习小提琴。 (violin)", "She is practising the violin for her upcoming concert."),
("他提高音量，确保每个人都能清晰地听到他的声音。 (voice)", "He raised his voice to make sure everyone could hear him clearly."),
("和一个不愿倾听的人争论是浪费时间。 (waste)", "It's a waste of time arguing with someone who won't listen."),
("海洋研究的一个基本部分是了解海浪及其规律。 (wave)", "One basic part of ocean study is understanding waves and how they work."),
],
66: [
("很多人认为财富是成功的关键。 (wealth)", "Many people believe that wealth is the key to success."),
("这个秤最多可以称重100公斤。 (weigh)", "This scale can weigh up to 100 kilograms."),
("从你开始锻炼以来你减了多少体重? (weight)", "How much weight have you lost since you started exercising?"),
("垃圾分类包括四种类别：可回收物、有害垃圾、干垃圾和湿垃圾。 (wet)", "Garbage sorting includes four categories: recyclable, harmful, dry, and wet waste."),
("我们关上了所有的窗以抵御强风。 (wind)", "We closed all the windows to protect ourselves against the strong wind."),
],
67: [
("为紧急情况存点钱是明智的。 (wise)", "It's wise to save some money for emergencies."),
("不面对挑战，我们就无法取得进步。 (without)", "We can't make progress without facing challenges."),
("你介意我借用你的自行车几分钟吗? (would)", "Would you mind if I borrowed your bike for a few minutes?"),
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
print('updated Day41-67 and merged C2E-S2.md')
