

## Intro

Tarot divinations is a decade long experiment of a programmer and mystical hobbiest. Inspiration for this website has come from 'Path of the Fool' , Michael Tsarions take on the 78 card deck. This is 'spirit tooling', using the best in modern software. 

## The Product
- Oracle with 7 spreads
- Readings Journal with filtering
- Oracle interpreations (LLM)
- User login and account settings

## Reading Oracle - Truly random shuffle algorithm
- Our shuffle module uses your machines entropy. This is done using the browsers own cryptographic library and draws on your own device's pool of physical unpredictability. It works the same way if you would draw names from a hat, each card getting an equal chance of landing in evry position. No one can predict order, not even us, give your subconsious the best conditions to pick those cards it wants you to see.

# Single, Two, Three Card Reading
- The single card reading allows the user to pick one answer card. Less useful than a two card reading but better than nothing.
- Two and three cards give the user 2 or three cards to meditate and reflect on. Depending on how much content the user wants to consider, either two or three cards will give adequate information on a subject at hand.

# Past, Present, Future Reading
- This reading provides a timeline, a sort of look back at what has been going on in our lives, an observation of our current circumstances and what may lay ahead. This can be a really powerful reading and offer the user an intense 'wow' moment.

# Four card, elemental Reading
- This reading provides insight into 'being' in the 4 worlds, namely: thoughts, emotion, thinking and earth. It provides rich information on where we stand within those elemental realms. Very insightful and meaningful reading for the novice and advanced reader.


## Readings Journal
- Tag your favourite readings (great for pattern observability)
- Paginate and filter on: spread type, birthdate, tags , sort on date created
- Save your readings in a safe guarded database, no cloud, no big US tech. In a predisclosed European location under the safe guarding of the maintainer of this project


## Oracle Interpretations
- After much experimentation we are happy with the so called 'frontier' LLM models and their ability to synthesis card data into meaning interpretations. Modern LLMs, like Openai GPT range, are trained on vast data sets, this includes occult and esoteric data
- Although we are not in favour of using AI everywhere, for our oracle interpretations we think it gives excellent results and good value
- We believe access to many readings, allows the user quick access to quick information on spreads they have pulled, in this
- respect they can curate meaningful readings, see patterns and enjoy the process. To provide quick reading information and not wait days for is the core of - our platform

## Significators
- The Significators spread is our personal Tarot chart and requires the birthday as input. On that particular day we can deduce a number of significant cards
which reference core character, challenges and strengths and destiny. Similar to an astrological chart, our Significators chart highlights those attributes 
and personal traits of the person born on that day. When using the Tarot it is important to know the significators of the person or people the readings include, because their significators may show up and if they do, more meaning should be given to that reading. This of course includes the querents significators. { inlcude info from readings-config.json }

## Tree of Life
- This reading is the classic Kabalistic style spread. Offering the user 11 sephora zones and one card for each zone. Zones sent for interpretation are the named Kabalistic sephora. The Tree of Life reading gives important information with regards to past, present and future influences for the person. The Tree of Life reading is very insightful and can be considered a divination art of its own. 11 perspectives with rich enigmatic Tarot imagery and symbolism makes this spread a particularly powerful player. 
{ inlcude info from readings-config.json }

