#!/usr/bin/env python3
from pathlib import Path

base = Path('/Users/linsen/projects/c2e/result/s2_days')

DATA = {
1: [
("每个人生来就有学习的能力。 (ability)", "Everyone is born with the ability to learn."),
("许多研究表明，这一行为有很多好处。 (act)", "Many studies have shown that this act has many benefits."),
("我希望你能接受我的道歉。 (accept)", "I hope you can accept my apology."),
("他匆匆忙忙地跑过马路。 (across)", "He ran across the road in a hurry."),
("当我到达机场时，飞机已经起飞了。 (airport)", "By the time I arrived at the airport, the plane had already taken off."),
],
2: [
("过马路时看手机容易导致事故。 (accident)", "Looking at the phone while crossing the road may cause an accident."),
("事实上，现在并没有在下雨。 (actually)", "Actually, it's not raining now."),
("这里是一条关于学生如何应对危险的建议。 (advice)", "Here is a piece of advice for students on how to deal with danger."),
("我们老师不允许我们在学校使用手机。 (allow)", "Our teacher doesn't allow us to use mobile phones in the school."),
("要解决这个问题几乎是不可能的。 (almost)", "It's almost impossible to solve this problem."),
],
3: [
("独自在河里游泳对孩子们来说是危险的。 (alone)", "Swimming alone in the river is dangerous for children."),
("有人有兴趣成为一名志愿者吗? (anyone)", "Is anyone interested in being a volunteer?"),
("这个故事告诉我们，只要我们去做，一切皆有可能。 (anything)", "This story tells us that anything is possible if we go for it."),
("这个地区很适合徒步、骑自行车等运动。 (area)", "This area is great for sports like hiking and biking."),
("注意你作业里的拼写错误。 (attention)", "Pay attention to the spelling mistakes in your homework."),
],
4: [
("你知道猎隼 (falcon) 是世界上速度最快的动物之一吗? (among)", "Do you know that the falcon is among the fastest animals in the world?"),
("如果你去另一个国家，你会买什么东西? (another)", "If you go to another country, what kind of things would you buy?"),
("有了智能手机，人们可以随时随地发消息。 (anywhere)", "With smartphones, people can send messages anywhere at any time."),
("我为我说过的话道歉。 (apologise)", "I apologise for what I said."),
("看起来他已经离开了。 (appear)", "It appears that he has already left."),
],
5: [
("你家乡的平均气温是多少? (average)", "What is the average temperature in your hometown?"),
("请原谅。我把你当成别人了。 (beg)", "I beg your pardon. I thought you were someone else."),
("不要把电池扔进垃圾箱里。 (bin)", "Don't throw the batteries in the bin."),
("他不小心打翻了一个墨水瓶。 (bottle)", "He accidentally knocked over an ink bottle."),
("如果你违反法律，你将会受到惩罚。 (break)", "If you break the law, you will be punished."),
],
6: [
("记者写了一篇有关新政策的文章。 (article)", "The journalist wrote an article about the new policy."),
("在战争中，攻击和防御同样重要。 (attack)", "In war, attack and defense are equally important."),
("台风期间我们应该避免站在树木附近。 (avoid)", "During a typhoon, we should avoid standing near trees."),
("你能告诉我如何在工作和娱乐之间保持平衡吗? (balance)", "Can you tell me how to keep a balance between work and play?"),
("水、食物和空气是生命的基本需求。 (basic)", "Water, food and air are the basic needs for life."),
],
7: [
("牙医建议我一天刷三次牙。 (brush)", "The dentist advised me to brush my teeth three times a day."),
("地震后，政府为无家可归的人们建造了庇护所。 (build)", "After the earthquake, the government built shelters for homeless people."),
("故宫 (The Forbidden City) 是中国最重要的历史建筑之一。 (building)", "The Forbidden City is one of the most important historical buildings in China."),
("看! 这些蝴蝶多漂亮啊! (butterfly)", "Look! How beautiful these butterflies are!"),
("西安曾经是唐朝 (the Tang Dynasty) 的都城。 (capital)", "Xi'an was once the capital of the Tang Dynasty."),
],
8: [
("宇宙之美在于它的浩瀚与神秘。 (beauty)", "The beauty of the universe lies in its vastness and mystery."),
("对你来说这个知识可能有点难以理解。 (bit)", "It may be a little bit hard for you to understand this knowledge."),
("暴风雨阻塞了道路，使得人们难以出行。 (block)", "The storm blocked the road, making it difficult for people to travel."),
("这位艺术家的作品架起了传统艺术和现代艺术之间的桥梁。 (bridge)", "The artist's work bridges the gap between traditional and modern art."),
("深呼吸可以帮助你在紧张时冷静下来。 (calm)", "Taking a deep breath can help you to calm down when you are stressed."),
],
9: [
("大雨导致足球比赛被取消了。 (cause)", "The heavy rain caused the football match to be canceled."),
("人们以不同的方式庆祝春天的到来。 (celebrate)", "People celebrate the arrival of spring in different ways."),
("人工智能可能会改变我们未来的工作方式。 (change)", "Artificial intelligence may change the way we work in the future."),
("如今，电影《哪吒》中的人物关系被赋予了现代意义。 (character)", "Now, the relationships among the characters in the movie Ne Zha are given modern meanings."),
("离开家之前，请检查你的钥匙。 (check)", "Before leaving home, please check your keys."),
],
10: [
("粗心的学生经常在考试中丢分。 (careless)", "Careless students often lose marks in exams."),
("学校组织了一次慈善活动，为有需要的学生募捐。 (charity)", "The school organized a charity event to raise money for students in need."),
("我更喜欢面对面聊天，而不是通过短信。 (chat)", "I prefer to chat face-to-face rather than through text messages."),
("演出结束后，观众们欢呼鼓掌。 (cheer)", "After the performance, the audience cheered and applauded."),
("选择一本好书是提升你阅读技巧的关键。 (choose)", "Choosing a good book is the key to improving your reading skills."),
],
11: [
("我不小心点击了错误的文件并且打开了它。 (click)", "I accidentally clicked the wrong file and opened it."),
("突然，天空布满了乌云。 (cloud)", "Suddenly, the sky was covered with dark clouds."),
("我们提早到达，为了在音乐会上找到好位置。 (concert)", "We arrived early to get good seats for the concert."),
("我们需要计算票数看看谁赢得了奖品。 (count)", "We need to count the votes to see who won the prize."),
("每个国家都有自己的传统和习俗。 (country)", "Every country has its own traditions and customs."),
],
12: [
("作家清晰地描述了故事中的每个细节。 (clearly)", "The writer described every detail in the story clearly."),
("青少年们应该多与父母沟通。 (communicate)", "Teenagers should communicate more with their parents."),
("我能和你一起参加社区服务吗? (community)", "Can I join you in the community service?"),
("在好朋友的陪伴下，时间过得很快。 (company)", "In the company of good friends, time flies quickly."),
("建立自信需要时间和练习。 (confidence)", "Building confidence takes time and practise."),
],
13: [
("技术和艺术的结合可以创造更多的可能。 (create)", "The combination of technology and art can create more possibilities."),
("学习不同的文化能开阔我们的视野。 (culture)", "Learning about different cultures can broaden our horizons."),
("每日锻炼可以改善你的身心健康。 (daily)", "Daily exercise can improve your physical and mental health."),
("这个三角形的角度是60度。 (degree)", "The angle of this triangle is 60 degrees."),
("如果我们不保护自然，一些野生动物可能会在未来灭绝。 (die)", "If we don't protect nature, some wildlife may die out in the future."),
],
14: [
("一个自信的人通常会吸引他人。 (confident)", "A confident person often attracts others."),
("我校下周将举办一场英语演讲比赛。 (contest)", "Our school will hold an English speech contest next week."),
("我会把我收到的电子邮件的副本发给你。 (copy)", "I will send you a copy of the e-mail I received."),
("咳嗽时请确保捂住你的嘴巴。 (cover)", "Make sure to cover your mouth when you cough."),
("洪水造成的破坏太大，以至于这些建筑在短时间内无法重建。 (damage)", "The damage caused by the flood was so large that the buildings cannot be rebuilt in a short time."),
],
15: [
("结果与我预想的相当不同。 (different)", "The result is quite different from what I expected."),
("科学家在实验室发现了新的化学元素。 (discover)", "Scientists discovered a new chemical element in the lab."),
("他努力工作，使他的梦想成真。 (dream)", "He works hard to make his dream come true."),
("过去几周汽油价格已经降低了。 (drop)", "The price of gas has dropped over the past few weeks."),
("干燥的气候使植物难以生长。 (dry)", "The dry climate makes it difficult for plants to grow."),
],
16: [
("据报道，由于全球变暖，北极熊正处于危险之中。 (danger)", "It's reported that polar bears are in danger because of global warming."),
("在这个地区晚上独自走路是危险的。 (dangerous)", "It's dangerous to walk alone at night in this area."),
("一个好的领导者必须能够做出艰难的决定。 (decision)", "A good leader must be able to make tough decisions."),
("浪费这么美味的食物真可惜。 (delicious)", "It's a pity to waste such delicious food."),
("当她听到坏消息时，她的笑容消失了。 (disappear)", "Her smile disappeared when she heard the bad news."),
],
17: [
("电灯泡是托马斯·爱迪生 (Thomas Edison) 发明的。 (electric)", "The electric light bulb was invented by Thomas Edison."),
("我更喜欢使用省电的电器。 (electricity)", "I prefer to use electric appliances that save electricity."),
("有没有其他你想邀请的人呢? (else)", "Is there someone else you would like to invite?"),
("该项目旨在鼓励学生发展他们的才能。 (encourage)", "The program aims to encourage students to develop their talents."),
("使用公共交通可以帮助节约能源并减少污染。 (energy)", "Using public transport can help save energy and reduce pollution."),
],
18: [
("贫富差距正在不断扩大。 (divide)", "There is a growing divide between the rich and the poor."),
("请把纸对折后再剪开。 (double)", "Please double the paper before you cut it."),
("你可以从官方网站下载最新版本的软件。 (download)", "You can download the latest version of the software from the official website."),
("这种药物对治疗头痛非常有效。 (effective)", "This medicine is very effective in treating headaches."),
("在紧急情况下保持冷静是很重要的。 (emergency)", "It is important to stay calm in an emergency."),
],
19: [
("期末考试前夕我感到非常紧张。 (eve)", "I feel very nervous on the eve of the final exam."),
("尽管下着雨，我们还是决定去散步。 (even)", "Even though it was raining, we decided to go for a walk."),
("这是一个我们永远不会忘记的难忘活动。 (event)", "It was a memorable event that we will never forget."),
("很多学生觉得科学实验既令人兴奋又有趣。 (exciting)", "Many students find science experiments to be exciting and fun."),
("你认为成功需要什么样的经验? (experience)", "What kind of experience do you think is necessary for success?"),
],
20: [
("冬天的结束意味着春天即将到来。 (end)", "The end of winter means that spring is on the way."),
("社交媒体是现在很多人日常生活的一部分。 (everyday)", "Social media is now a part of many people's everyday lives."),
("这家餐厅以其优质的服务和美味的食物而闻名。 (excellent)", "This restaurant is known for its excellent service and delicious food."),
("当你解释某事时，使用清晰的例子会有所帮助。 (explain)", "When you explain something, it's helpful to use clear examples."),
("发烧几天后他开始恢复。 (fever)", "After a few days of fever, he began to recover."),
],
}

for day, items in DATA.items():
    lines = [f"### Day{day}", ""]
    for i, (q, a) in enumerate(items, 1):
        lines.append(f"{i}. {q}")
        lines.append(f"  - {a}")
    (base / f"Day{day}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

# merge all days
import re
all_files = sorted(base.glob('Day*.md'), key=lambda p: int(re.search(r'Day(\d+)', p.name).group(1)))
blocks = [f.read_text(encoding='utf-8').strip() for f in all_files]
Path('/Users/linsen/projects/c2e/result/C2E-S2.md').write_text("\n\n".join(blocks)+"\n", encoding='utf-8')
print('updated Day1-20 and merged C2E-S2.md')
