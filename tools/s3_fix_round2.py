#!/usr/bin/env python3
from pathlib import Path
import re

base = Path('/Users/linsen/projects/c2e/result/s3_days')

DATA = {
2: [
("根据物理定律，能量不能被创造或破坏。 (according to)", "According to physical law, energy cannot be created or destroyed."),
("这位作家以写情节丰富的小说而闻名。 (action)", "The author is known for writing novels that are full of action."),
("这位年轻人决定参军保卫祖国。 (army)", "The young man decided to join the army to defend his country."),
("人们应该意识到保护环境的重要性。 (aware)", "People should be aware of the importance of protecting the environment."),
("竹筏在古代被用于交通运输。 (bamboo)", "Bamboo rafts were used for transportation in ancient times."),
],
3: [
("虽然前方会遇到一些挑战，但我期待着克服它们并实现我的目标。 (although)", "Although there are some challenges ahead, I am looking forward to overcoming them and achieving my goals."),
("科学家们正在观察蚂蚁以了解它们的习性。 (ant)", "Scientists are observing ants to understand their habits."),
("语言学习应用程序让我能与母语人士练习说英语。 (app)", "The language-learning app allows me to practise speaking English with native speakers."),
("我计划这个周末参加一个关于历史的讲座。 (attend)", "I plan to attend a lecture on history this weekend."),
("这支乐队以其独特的音乐风格而闻名。 (band)", "This band is famous for its unique music style."),
],
5: [
("洗完澡后，我感觉神清气爽，为新的一天做好了准备。 (bath)", "After having a bath, I felt refreshed and ready for the new day."),
("墙上的画属于这个画廊。 (belong)", "The paintings on the wall belong to this gallery."),
("政府正在采取有利于环境的措施。 (benefit)", "The government is taking measures for the benefit of the environment."),
("家长不应对孩子的不良行为视而不见。 (blind)", "Parents shouldn't turn a blind eye to their children's bad behaviour."),
("孩子们兴奋地看到烟花在天空中炸开。 (blow)", "The kids were excited to see fireworks blow up in the sky."),
],
6: [
("这两种动物在外表上有很多共同之处。 (common)", "These two animals have a lot in common in appearance."),
("这款新软件让你更容易掌控你的数字生活。 (control)", "The new software makes it easier to take control of your digital life."),
("购买当地人制作的手工制品有助于创造就业机会。 (create)", "Buying handmade products created by local people can help create jobs."),
("可爱的小猫太困了，以至于它很快就睡着了。 (cute)", "The cute kitten was so sleepy that it fell asleep quickly."),
("由于医疗的改善，那座城市的死亡率已经下降了。 (death)", "The death rate in that city has decreased due to improved medical care."),
],
7: [
("讲座太无聊了，以至于我忍不住打了哈欠。 (boring)", "The lecture was so boring that I couldn't help yawning."),
("为了惊喜派对，我向朋友们借了一些装饰品。 (borrow)", "I borrowed some decorations from friends for the surprise party."),
("人脑比我们曾经认为的要复杂得多。 (brain)", "The human brain is much more complex than we once thought."),
("这座旧木屋昨晚意外地被烧毁了。 (burn)", "The old wooden house was accidentally burned down last night."),
("我父亲的公司上周派他去欧洲出差。 (business)", "My father's company sent him on business to Europe last week."),
],
9: [
("近年来癌症研究取得了显著进展。 (cancer)", "Cancer research has made significant progress in recent years."),
("许多孩子在万圣节装扮成他们最喜欢的卡通人物。 (cartoon)", "Many kids dress up as their favourite cartoon characters on Halloween."),
("该地区的历史可以追溯到19世纪。 (century)", "The history of this region dates back to the 19th century."),
("芯片被广泛应用于人工智能等领域。 (chip)", "Chips are widely used in fields such as artificial intelligence."),
("莉莉有一大群总是支持她的朋友。 (circle)", "Lily has a large circle of friends who always support her."),
],
14: [
("更重要的是，有必要学会如何独立解决问题。 (importantly)", "More importantly, it is necessary to learn how to solve problems independently."),
("研究项目涉及到多个阶段，包括数据收集在内。 (including)", "The research project involves several phases, including data collection."),
("在一次独家采访中，主厨透露了他的秘方。 (interview)", "In an exclusive interview, the chef revealed his secret recipe."),
("我们不应该拿别人的外貌开玩笑。 (joke)", "We shouldn't make jokes about others' appearance."),
("众所周知，植物需要阳光才能生长。 (knowledge)", "It is common knowledge that plants need sunlight to grow."),
],
15: [
("许多年轻人似乎疯狂追逐这一最新时尚潮流。 (crazy)", "Many young people seem to be crazy about following this latest fashion trend."),
("沙漠里的沙丘因为风的原因而不断改变形状。 (desert)", "The sand dunes in the desert are constantly changing due to the wind."),
("新的想法往往会从讨论中产生。 (develop)", "New ideas often develop from discussions."),
("一个社会的文化发展反映了它的价值观和信仰。 (development)", "The cultural development of a society reflects its values and beliefs."),
("数字设备可以大大提升我们的工作效率。 (digital)", "Digital devices can greatly improve our working efficiency."),
],
29: [
("医生告知了患者治疗方案。 (inform)", "The doctor informed the patient about the treatment plan."),
("探险家们在洞穴内寻找关于失落之城的线索。 (inside)", "The explorers searched for clues about the lost city inside the cave."),
("全班同学踏上了一段森林之旅，去了解植物。 (journey)", "The whole class set off on a journey to the forest to learn about plants."),
("我不小心把咖啡洒在键盘上了，现在它不能正常工作了。 (keyboard)", "I accidentally spilled coffee on the keyboard, and now it doesn't work properly."),
("取决于季节的不同，白菜的价格每公斤2元到3元不等。 (kilo)", "The price of cabbage varies from 2 to 3 yuan per kilo depending on the season."),
],
32: [
("我们应该严肃对待减少污染和环境保护。 (serious)", "We should be serious about reducing pollution and protecting the environment."),
("我的姐姐被梦寐以求的大学录取时，她感到震惊又兴奋。 (shocked)", "My sister felt shocked and excited when she got accepted into her dream university."),
("我们学校注重长期学习，而不仅是短期考试成绩。 (short-term)", "Our school focuses on long-term learning rather than short-term test scores."),
("发达国家的经济形势与发展中国家的不同。 (situation)", "The economic situation in developed countries is different from that in developing countries."),
("许多学生正在学习计算机技能，为未来的工作做准备。 (skill)", "Many students are learning computer skills to prepare for future jobs."),
],
34: [
("毕业典礼上，校长向同学们作了一段演讲。 (speech)", "At the graduation ceremony, the headmaster gave a speech to the students."),
("长话短说，这名学生设法克服了困难并取得了优异的成绩。 (story)", "To cut a long story short, the student managed to overcome the difficulties and got excellent grades."),
("这条笔直的路径直通向我们的目的地。 (straight)", "The straight path leads directly to our destination."),
("在英语中，单词的重音可以改变它的含义。 (stress)", "In English, the stress of a word can change its meaning."),
("志愿者成功地帮助无家可归的人找到住所和食物。 (succeed)", "The volunteer succeeded in helping the homeless find shelter and food."),
],
45: [
("小偷在人群中穿行，以避免被注意到。 (snake)", "The thief snaked his way through the crowd to avoid being noticed."),
("该软件是专为年轻用户的需求设计的。 (software)", "This software is designed for the needs of young users."),
("地图被摊开在地上，这样每个人都能清楚地看到。 (spread)", "The map was spread out on the floor so that everyone could see it clearly."),
("在夏令营停留的时光让孩子们有机会了解自然。 (stay)", "The stay at the summer camp gave the children a chance to learn about nature."),
("男孩踩在了香蕉皮上，失去平衡并摔倒了。 (step)", "The boy stepped on the banana peel, lost his balance, and fell down."),
],
46: [
("实验的成功表明学生们对这个主题有良好的理解。 (success)", "The success of the experiment showed that the students had a good understanding of the topic."),
("团队成员的大力支持帮助了团队按时完成任务。 (support)", "The strong support of the team members helped the group complete the task on time."),
("故事令人吃惊的结局让读者们感到兴奋不已。 (surprising)", "The surprising ending of the story made the readers feel excited."),
("录音进行到一半时，录音机突然停止了工作。 (tape)", "The tape recorder suddenly stopped working in the middle of the recording."),
("这位有才能的年轻科学家在可再生能源领域取得了突破。 (talented)", "The talented young scientist made a breakthrough in the field of renewable energy."),
],
49: [
("这个装置单元由一个自动运行的计算机程序控制。 (unit)", "This unit is controlled by a computer program that runs automatically."),
("机器人不会移动，除非它接收到信号。 (unless)", "The robot will not move unless it receives a signal."),
("胜利庆祝后，队员接受了当地媒体的采访。 (victory)", "After the victory celebration, the team members gave interviews to the local media."),
("流感病毒在学校和办公室等拥挤场所容易传播。 (virus)", "The flu virus spreads easily in crowded places like schools and offices."),
("志愿服务是培养社交技能和积累经验的好方法。 (voluntary)", "Voluntary service is a great way to develop social skills and gain experience."),
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
Path('/Users/linsen/projects/c2e/result/C2E-S3.md').write_text('\n\n'.join(blocks)+'\n', encoding='utf-8')
print('patched days', sorted(DATA.keys()))
print('merged C2E-S3.md')
