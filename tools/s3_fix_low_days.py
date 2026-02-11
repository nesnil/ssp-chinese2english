#!/usr/bin/env python3
from pathlib import Path
import re

base = Path('/Users/linsen/projects/c2e/result/s3_days')

DATA = {
1: [
("古人能够根据太阳的位置分辨时间。 (able)", "Ancient people were able to tell time by the position of the sun."),
("经理缺席了会议，所以我们不得不重新安排时间。 (absent)", "The manager was absent from the meeting, so we had to reschedule it."),
("公司计划利用新技术来提高生产力。 (advantage)", "The company plans to take advantage of the new technology to increase productivity."),
("我同意她在这个问题上的看法。 (agree)", "I agree with her opinion on this issue."),
("在未来，人工智能将在我们日常生活中扮演重要角色。 (AI)", "In the future, AI will play an important role in our daily lives."),
],
4: [
("理解基本科学概念有助于我们理解周围的世界。 (basic)", "Understanding basic science concepts helps us make sense of the world around us."),
("火车由于天气恶劣而延误了一个小时。 (by)", "The train was delayed by an hour due to bad weather."),
("最好有一个备用计划，以防失败。 (case)", "It's better to have a backup plan in case of failure."),
("没有人确切地知道金字塔是如何建造的。 (certain)", "No one knows for certain how the pyramids were built."),
("这个小镇的居民有很强的社区意识。 (citizen)", "The citizens of this small town have a strong sense of community."),
],
8: [
("我们的成功取决于我们是否努力。 (depend)", "Our success depends on whether we work hard or not."),
("她在加入舞蹈社后发现了自己对舞蹈的热爱。 (discover)", "She discovered her passion for dancing after she joined the dance club."),
("老师把班级分成小组进行一场知识竞赛。 (divide)", "The teacher divided the class into teams for a quiz competition."),
("这部电影有一个我意想不到的戏剧性结尾。 (dramatic)", "The movie had a dramatic ending that I didn't expect."),
("计算机的硬盘驱动器存储了所有的数据。 (drive)", "The computer's hard drive stores all the data."),
],
10: [
("目前尚不清楚新的安全标准何时生效。 (effect)", "It's not clear when the new standards will come into effect."),
("他在政治生涯中树立了很多强大的敌人。 (enemy)", "He made many powerful enemies during his political career."),
("别再找借口了，开始对自己的行为负责吧。 (excuse)", "Stop making excuses and start taking responsibility for your actions."),
("我们需要加快速度，尽快完成隧道的建设。 (finish)", "We need to speed up to finish building the tunnel as soon as possible."),
("人们保持健康的最佳方法之一是养成健康的饮食习惯。 (fit)", "One of the best ways for people to keep fit is to develop healthy eating habits."),
],
11: [
("要做出明智的决定，你需要保持头脑清醒并考虑所有方面。 (clear)", "To make clear decisions, you need to keep a clear mind and consider all aspects."),
("在被技术娴熟的机械师修理过后，这辆车的状况极佳。 (condition)", "The car is in excellent condition after being repaired by the skilled mechanic."),
("科学家认为压力与精神疾病之间存在密切联系。 (connection)", "Scientists believe there is a close connection between stress and mental illness."),
("外面持续不断的噪音让我整晚都睡不着觉。 (continuous)", "The continuous noise outside kept me awake all night."),
("我们和邻居们聊起了即将到来的国庆节。 (conversation)", "We got into a conversation with our neighbours about the upcoming National Day."),
],
13: [
("两国自上个世纪初以来一直在经贸发展方面进行合作。 (cooperate)", "These two countries have been cooperating in trade and economic development since the beginning of the last century."),
("假期即将到来，我期待着我们的家庭旅行。 (corner)", "The holiday is just around the corner, and I'm looking forward to our family trip."),
("这件衬衫是棉质的，穿起来很舒服。 (cotton)", "The shirt is made of cotton, which makes it comfortable to wear."),
("很多艺术家选择在乡村工作以寻找灵感。 (countryside)", "Many artists choose to work in the countryside for inspiration."),
("我们花了几天时间探索这座充满活力的城市。 (couple)", "We spent a couple of days exploring this lively city."),
],
19: [
("任何事情都逃不过这位警官敏锐的眼光。 (eagle)", "Nothing escapes the police officer's eagle eye."),
("通过教育，我们可以弥合不同文化之间的差距。 (education)", "Through education, we can bridge the gap between different cultures."),
("要么接受挑战，要么保持沉默。 (either)", "Either you accept the challenge or you remain silent."),
("老师让课堂讨论成为了一项愉快而有意义的活动。 (enjoyable)", "The teacher made the class discussion an enjoyable and meaningful activity."),
("这次旅行好极了，除了要长途跋涉到达那里。 (except)", "The trip was wonderful, except for the long journey to get there."),
],
23: [
("我们英语老师鼓励我们观看外国电影来提高听力技巧。 (foreign)", "Our English teacher encourages us to watch foreign movies to improve our listening skills."),
("尽管我们失败了很多次，但我们从未停止向前进。 (forward)", "Although we failed many times, we never stopped moving forward."),
("如果温度降到0°C以下，水就会结冰。 (freeze)", "If the temperature drops below 0°C, water freezes."),
("随着经济的快速增长，近年来出现了更多的就业机会。 (growth)", "With rapid economic growth, more job opportunities have emerged in recent years."),
("客人向酒店经理投诉了隔壁的噪音。 (guest)", "The guest complained to the hotel manager about the noise next door."),
],
24: [
("当他听到坏消息时，他脸色变得苍白。 (pale)", "When he heard the bad news, his face turned pale."),
("父母健康的人格对孩子有积极的影响。 (personality)", "Parents' healthy personalities have a positive influence on children."),
("教授指出，这个研究课题还没有被探索过。 (point)", "The professor pointed out that this research topic had not been explored yet."),
("工厂正在为节日印制大量海报。 (print)", "The factory is printing a large number of posters for the festival."),
("在周末，我更喜欢待在家里看喜剧节目。 (programme)", "On weekends, I prefer to stay at home and watch comedy programmes."),
],
25: [
("汉堡包是美国快餐文化中最受欢迎的食物之一。 (hamburger)", "Hamburgers are one of the most popular foods in American fast-food culture."),
("魔术师把手伸进他的帽子里，掏出一只鸽子放飞到空中。 (hat)", "The magician reached into his hat, pulled out a dove, and set it free into the sky."),
("更好的公共卫生可以极大地提升人们的生活质量。 (health)", "Better public health can greatly improve the quality of people's lives."),
],
26: [
("多亏司机良好的驾驶技术，他们安全到达了目的地。 (reach)", "Thanks to the driver's good skills, they reached their destination safely."),
("近年来，空气污染问题引起了人们的关注。 (recent)", "In recent years, the problem of air pollution has attracted people's attention."),
("最近天气变化多端，我们需要密切注意天气预报。 (recently)", "The weather has been changing recently, so we need to keep an eye on the weather forecast."),
("这个计算机系统可以识别并翻译不同的语言。 (recognize)", "The computer system can recognize and translate different languages."),
("这位艺术家拒绝以任何价格出售她的作品。 (refuse)", "The artist refused to sell her work at any price."),
],
30: [
("书评让我们能对这本书的主题和人物有很好的了解。 (review)", "The book review allows us to have a good understanding of this book's main theme and characters."),
("运动员们在起跑线上站成了一排，等待比赛开始。 (row)", "The athletes stood in a row at the starting line, waiting for the race to begin."),
("博物馆使用安保系统来保护珍贵艺术品不被盗。 (security)", "The museum uses security systems to protect precious artworks from being stolen."),
("不要习惯于在黑暗的房间里看屏幕。这对你的眼睛有害。 (screen)", "Don't get used to looking at the screen in a dark room. It's harmful to your eyes."),
("根据交通规则，乘客必须在汽车启动前系好安全带。 (seat)", "According to traffic rules, passengers must fasten their seat belts before the car starts."),
],
31: [
("在法国文化中，朋友们亲吻对方的面颊作为问候是很常见的。 (kiss)", "In French culture, it's common for friends to kiss each other's cheeks as a greeting."),
("我们班有大量的学生有兴趣加入科学社团。 (large)", "A large number of students in our class are interested in joining the science club."),
("中国近年来在全球经济中处于领先地位。 (lead)", "China has taken the lead in the global economy in recent years."),
("雷电会在干燥地区引起火灾，因此人们在这种天气下应小心。 (lightning)", "Lightning can cause fires in dry areas, so people should be careful during such weather."),
("魔术师的魔术表演非常受欢迎，以至于门票很快就售罄。 (magician)", "The magician's magic shows were so popular that tickets sold out quickly."),
],
33: [
("老师们召开了一次会议来讨论教学方法的改进。 (meeting)", "The teachers held a meeting to discuss the improvement of teaching methods."),
("博物馆会定期进行安全检查以防事故发生。 (museum)", "Regular safety checks are carried out in the museum to prevent accidents."),
("我们错过了拍摄完美照片的机会，因为光线条件不理想。 (miss)", "We missed the chance to take the perfect photo because the light conditions were not ideal."),
("在现代社会，心理健康比以前受到更多关注，因为人们面临着更多压力。 (modern)", "In modern society, mental health is receiving more attention than before because people are under greater pressure."),
("为了避免打扰他人，我们在电影院看电影时应该关掉手机。 (movie)", "To avoid disturbing others, we should turn off our phones when watching a movie."),
],
37: [
("男队的配合如此完美，以至于他们提前完成了项目。 (perfect)", "The team's cooperation was so perfect that they completed the project ahead of schedule."),
("听到这个可怜的孤儿的消息后，我不禁对他产生了怜悯。 (pity)", "After hearing the news about the poor orphan, I couldn't help feeling pity for him."),
("她很高兴看到自己的努力最终得到了回报。 (pleased)", "She is pleased to see her hard work finally pay off."),
("这座城市的人口不到一百万，但却以其美丽风景而闻名。 (population)", "This city has a population of less than one million, but it is known for its beautiful scenery."),
("定期锻炼对你的身体健康有积极影响。 (positive)", "Regular exercise has a positive effect on your physical fitness."),
],
39: [
("医生建议病人应该尽快休息。 (possible)", "The doctor suggested that the patient should rest as soon as possible."),
("当火锅开始沸腾时，我们可以开始加食材了。 (pot)", "We can start adding ingredients when the hot pot starts to boil."),
("在把牛奶倒进玻璃杯之前，确保杯子是干净的。 (pour)", "Before pouring the milk into the glass, make sure the glass is clean."),
("如果你在火车上遇到紧急情况，请按下按钮寻求帮助。 (press)", "If you encounter an emergency on the train, please press the button to call for assistance."),
("我的小学时光充满了欢声笑语，使得它们令人难忘。 (primary)", "My primary school days were filled with laughter, making them unforgettable."),
],
42: [
("很多研究人员认为，气候变化是当今世界面临的最大问题之一。 (researcher)", "Many researchers believe that climate change is one of the biggest problems facing the world today."),
("这位勇敢的消防员冒着一切风险扑灭了大火。 (risk)", "The brave fireman risked everything to put out the fire."),
("老师在上周的火箭实验中向学生讲授了物理学和工程学知识。 (rocket)", "The teacher taught students about physics and engineering during last week's rocket experiment."),
("咸海水不适合饮用，因为它含有大量盐分。 (salty)", "Salty seawater is not suitable for drinking because it contains a large amount of salt."),
("参加志愿者活动对我来说是一次令人满意的经历。 (satisfying)", "Taking part in the volunteer activity was a satisfying experience for me."),
],
43: [
("红围巾是荣誉的象征，每个学生都应该好好爱护它。 (scarf)", "The red scarf is a symbol of honour, and every student should take good care of it."),
("我的朋友让我保守他的秘密，我答应永远不会告诉任何人。 (secret)", "My friend asked me to keep his secret, and I promised I would never tell anyone."),
("我很少吃垃圾食品，因为这对我的健康有害。 (seldom)", "I seldom eat junk food because it's bad for my health."),
("公司给顾客寄了感谢信，感谢他们的支持。 (send)", "The company sent the customers thank-you letters for their support."),
("你在与别人握手时应进行直接的眼神交流并微笑。 (shake)", "You should make direct eye contact and smile when you shake hands with others."),
],
44: [
("真可惜音乐会在最后一刻被取消了。 (shame)", "What a shame it is that the concert was canceled at the last minute."),
("星星在夜空中闪烁，用它们柔和的光芒照亮了世界。 (shine)", "The stars shine in the night sky, lighting up the world with their soft light."),
("父母应承担起教导孩子良好价值观的责任。 (shoulder)", "Parents should shoulder the responsibility for teaching their children good values."),
("如果你不输入正确密码，系统将会关闭。 (shut)", "The system will shut down if you don't enter the correct password."),
("那堆有臭味的垃圾被留在房间角落好几天了。 (smelly)", "The smelly trash was left in the corner of the room for days."),
],
48: [
("这座塔是由钢和玻璃制成的，这使它看起来很现代。 (tower)", "The tower is made of steel and glass, which makes it look modern."),
("这个小镇通过一条穿山隧道与城市相连。 (town)", "The town is connected to the city by a tunnel that goes through the mountains."),
("医生向患者及其家属清楚地解释了治疗方案。 (treatment)", "The doctor explained the treatment plan clearly to the patient and his family."),
("垃圾车经过狭窄的街道时发出很大的声音。 (truck)", "The garbage truck made a loud noise as it passed through the narrow street."),
("女孩不确定电话里那陌生的声音是她朋友还是陌生人。 (unfamiliar)", "The girl wasn't sure whether the unfamiliar voice on the phone was her friend or a stranger."),
],
50: [
("这位消防员警告大家火灾期间不要使用电梯。 (warn)", "The fireman warned people not to use the elevator during a fire."),
("尽管她很富有，但她一直过着简单的生活。 (wealthy)", "Despite being wealthy, she always lives a simple life."),
("超市提供一系列种类繁多的商品，从新鲜蔬菜到电子电器。 (wide)", "The supermarket offers a wide range of goods, from fresh vegetables to electronic appliances."),
("火车将在几分钟内停靠车站。 (within)", "The train will stop at the station within the next few minutes."),
("即使当事情最糟糕的时候，他也总能保持乐观。 (worst)", "He was always optimistic, even when things were at their worst."),
],
}

for day, items in DATA.items():
    lines = [f"### Day{day}", ""]
    for i, (q, a) in enumerate(items, 1):
        lines.append(f"{i}. {q}")
        lines.append(f"  - {a}")
    (base / f"Day{day}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

# merge
all_files = sorted(base.glob('Day*.md'), key=lambda p: int(re.search(r'Day(\d+)', p.name).group(1)))
blocks = [f.read_text(encoding='utf-8').strip() for f in all_files]
Path('/Users/linsen/projects/c2e/result/C2E-S3.md').write_text("\n\n".join(blocks) + "\n", encoding='utf-8')
print('patched low days and merged C2E-S3.md')
