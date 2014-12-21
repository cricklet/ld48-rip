### Rest In Peace

I built this in Javascript/HTML5 from scratch for the Ludum Dare 48 hour gamedev competition.

In this game, you hop between alternate dimensions to kill bandits. The ghosts of the dead haunt one dimension and the dead come back to life in the other!

[You can play it here](https://dl.dropboxusercontent.com/u/43674030/ludlum/index.html)

### Developer notes:

I built the game from scratch in Javascript. As an experiment, I wanted to organize my code without using much OOP. The state of the game (player, bandits, ghosts, etc) is simply stored in arrays of JS objects (basically JSON). Then, different functions (like thinkPlayer or renderPlayer) take those objects and manipulate them. It lead to some awkwardness— i.e. I pass the player object to nearly every function— but worked well enough for the jam. This method is *very* good for sharing state (i.e. player location, bodies) between the two dimensions. No complicated inheritance (i.e. implements DayRenderable) shit needed :P. I don’t see this method as being useful for any larger projects, but it definitely works for something this simple.

I spent a lot of time on the art. The background is procedurally drawn by randomly peppering a pixellated gradient with squares of dark and light. The lighting in the dark dimension is drawn by painting a flickering semi-transparent radial gradient on top of each light source (the player’s torch and burning bodies). It’s amazing how much something like adding a flicker to the lighting can improve the atmosphere.

The AI of the robbers is pretty simple. Luckily, you don’t notice because you’re constantly switching between dimensions :). Each robber is a finite state machine: run to a random location -> aim in the direction of the player -> wait for player to enter your sights -> shoot or return to randomly running around.

The audio is done with as3sfxr and SunVox. I’m especially happy with the fire crackling which is just a noise-generator and a distortion-filter in SunVox. Unfortunately, I didn’t have time to make any music for the game (and I spent an hour in Audacity trying to get rid of the clicking in my loops :P).

The flipping dimensions mechanic gets pretty involved. Once multiple bandits start spawning at a time (and the bodies of the dead start piling up), you have to use each dimension as a way to escape the dangers of the other.
