#!/usr/bin/env python3
from pathlib import Path
import re

base = Path('/Users/linsen/projects/c2e/result/s3_days')

DATA = {
12: [
("这个博物馆在特定日子允许游客免费参观。 (free)", "This museum allows visitors to enter for free on certain days."),
("在开始一个项目之前，设定一个既具有挑战性又可实现的目标很重要。 (goal)", "Before starting a project, it is important to set a goal that is both challenging and achievable."),
("警卫检查了每个人的身份证才允许他们进入大楼。 (guard)", "The security guard checked everyone's ID before allowing them into the building."),
("我喜欢在美术馆闲逛并欣赏画作。 (hang)", "I like to hang around the art gallery and admire the paintings."),
("我无法想象生活在一个没有任何现代化设施的地方。 (imagine)", "I can't imagine living in a place without any modern facilities."),
],
18: [
("这位运动员设法突破了自己的极限，创造了新的个人纪录。 (manage)", "The athlete managed to push himself beyond his limits, setting a new personal record."),
("为了在历史测试中取得满分，她仔细复习了所有关键日期和事件。 (mark)", "In order to get full marks in the history test, she reviewed all the key dates and events carefully."),
("在交流中，我们应该注意肢体语言的意义。 (meaning)", "In communication, we should pay attention to the meaning of body language."),
("医生没有提到药物的任何副作用。 (mention)", "The doctor didn't mention any side effects of the medicine."),
("客厅里乱得一团糟，我们需要马上打扫干净。 (mess)", "The living room is in a mess, and we need to clean it right away."),
],
21: [
("工厂经理负责确保产品的质量。 (factory)", "The factory manager is responsible for ensuring the quality of the products."),
("医生应该熟悉常见疾病的症状。 (familiar)", "Doctors should be familiar with the symptoms of common diseases."),
("去年暑假非常精彩，充满了乐趣和难忘的经历。 (fantastic)", "Last summer vacation was fantastic, filled with fun and memorable experiences."),
("联合国的旗帜代表着和平与团结。 (flag)", "The flag of the United Nations represents peace and unity."),
("这家航空公司为学生提供实惠的航班选择。 (flight)", "This airline provides affordable flight options for students."),
],
22: [
("奥运会每四年举办一次，吸引了来自世界各地的运动员。 (Olympic)", "The Olympic Games are held every four years, attracting athletes from all over the world."),
("在开幕式期间，表演者们上演了一场精彩的表演。 (opening)", "During the opening ceremony, the performers put on a wonderful show."),
("该软件允许你远程操作系统。 (operate)", "This software allows you to operate the system remotely."),
("在我看来，从错误中学习是成长的关键。 (opinion)", "In my opinion, learning from mistakes is the key to growth."),
("电梯又出故障了，我们不得不走楼梯。 (order)", "The lift is out of order again, so we have to take the stairs."),
],
27: [
("稍微等一下，我正要解释关键点。 (hold)", "Hold on for a moment, I'm about to explain the key point."),
("渔网上的洞太小，以至于鱼游不过去。 (hole)", "The holes in the fishing net are too small for the fish to swim through."),
("他们一回到家就开始做家务。 (housework)", "They started to do the housework as soon as they got home."),
("他们把餐费算包括进了账单里。 (include)", "They included the cost of the meal in the bill."),
("慈善组织为贫困地区提供资金来发展当地工业。 (industry)", "The charity organization provides poor areas with money to develop their local industries."),
],
35: [
("遵守我们国家的法律是每个公民的义务。 (nation)", "It's every citizen's duty to obey the laws of our nation."),
("地震、洪水等自然灾害常常造成巨大破坏。 (natural)", "Natural disasters like earthquakes and floods often cause great damage."),
("无论是下雨还是寒冷的天气都无法阻止我们去徒步旅行。 (nor)", "Neither the rain nor the cold weather could stop us from going hiking."),
("现如今，越来越多的人喜欢在网上购物。 (nowadays)", "Nowadays, more and more people prefer shopping online."),
("学生们被要求将一个与他们的文化相关的物品带到学校。 (object)", "The students were asked to bring an object related to their culture to school."),
],
36: [
("他们惊讶地看到海滩上如此美丽的日落。 (surprised)", "They were surprised to see such a beautiful sunset on the beach."),
("我不小心把手机落在家里，错过了几条重要的短信。 (text)", "I accidentally left my phone at home and missed several important text messages."),
("我以为这个考试很容易，但结果却相当困难。 (thought)", "I thought this exam would be easy, but it turned out to be quite difficult."),
("考试期间，学生们应该再次检查每个答案，以避免错误。 (through)", "During the exam, students should go through each answer again to avoid mistakes."),
("科学家们发现了一种从未见过的微小物种。 (tiny)", "The scientists discovered a tiny species that had never been seen before."),
],
38: [
("中国家庭聚在一起庆祝春节，是一种传统习俗。 (traditional)", "It is a traditional custom for Chinese families to get together to celebrate the Spring Festival."),
("游客对当地餐馆的高价格和差服务感到不满意。 (unhappy)", "The tourists were unhappy with the high prices and poor service at the local restaurants."),
("搬家公司使用带轮子的大箱子来高效地运输家具。 (wheel)", "Moving companies use large boxes on wheels to transport furniture efficiently."),
("他想知道他明天是否必须穿制服去参加公司会议。 (wonder)", "He wonders if he has to wear a uniform to the company meeting tomorrow."),
("我们可以从这篇关于太空探索的文章中学到很多有用的知识。 (writing)", "We can learn a lot of useful knowledge from this writing about space exploration."),
],
47: [
("为了按时完成任务，提前计划并管理好时间是必要的。 (task)", "To complete a task on time, it's necessary to plan ahead and manage your time well."),
("团队合作有助于在团队成员之间建立信任和理解。 (teamwork)", "Teamwork helps build trust and understanding among group members."),
("我为期末考试努力学习了，所以我以高分通过了考试。 (therefore)", "I studied hard for the final exams. Therefore, I passed the exams with high scores."),
("口渴的人们聚集在井边取水，因为已经好几周没有下雨。 (thirsty)", "The thirsty people gathered around the well to get water because it had not rained for weeks."),
("尽管我们住在不同的城市，但我们仍然通过微信保持联系。 (touch)", "Even though we live in different cities, we still keep in touch with each other through WeChat."),
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
Path('/Users/linsen/projects/c2e/result/C2E-S3.md').write_text('\n\n'.join(blocks) + '\n', encoding='utf-8')
print('patched', sorted(DATA.keys()))
print('merged C2E-S3.md')
