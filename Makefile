CC = cc
CFLAGS = -Wall -Wextra -std=c11 $(shell pkg-config --cflags sdl2 sdl2_image sdl2_ttf)
LDFLAGS = $(shell pkg-config --libs sdl2 sdl2_image sdl2_ttf)

all: cardgame

cardgame: main.c cards.h
	$(CC) $(CFLAGS) -o cardgame main.c $(LDFLAGS)

clean:
	rm -f cardgame
