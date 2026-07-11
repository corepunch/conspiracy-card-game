#include <SDL.h>
#include <SDL_image.h>
#include <SDL_ttf.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include "cards.h"

#define BASE_WINDOW_W 1200
#define BASE_WINDOW_H 900
#define CARD_ATLAS_COLS 8
#define CARD_ATLAS_ROWS 8
#define MAX_HAND 12

typedef struct {
    int card_idx;
    SDL_FRect dst;
    bool in_row;
} HandCard;

typedef struct {
    SDL_Window *window;
    SDL_Renderer *renderer;
    TTF_Font *font_title;
    TTF_Font *font_title_sm;
    TTF_Font *font_body;
    TTF_Font *font_body_italic;
    TTF_Font *font_small;
    TTF_Font *font_value;
    SDL_Texture *atlas;
    SDL_Texture *table;
    SDL_Texture *card_front_chrome;
    SDL_Texture *card_back;
    int atlas_w, atlas_h;
    int cell_w, cell_h;

    int win_w, win_h;
    int card_w, card_h, card_gap;
    int hand_y, row_y;
    int margin;
    int title_bar_h;
    int img_margin, img_h;
    int text_margin, badge_size;
    int divider_gap;

    HandCard hand[MAX_HAND];
    int hand_count;

    int row_cards[16];
    int row_count;

    bool dragging;
    int drag_hand_idx;
    float drag_off_x, drag_off_y;
    float drag_x, drag_y;

    bool running;
} Game;

static void compute_layout(Game *g) {
    g->win_w    = BASE_WINDOW_W;
    g->win_h    = BASE_WINDOW_H;
    g->card_w   = 160;
    g->card_h   = 240;
    g->card_gap = 12;
    g->margin   = 10;
    g->hand_y   = g->win_h - g->card_h - 34;
    g->row_y    = 160;
    g->title_bar_h = 32;
    g->img_margin  = 10;
    g->img_h       = 90;
    g->text_margin = 10;
    g->badge_size  = 24;
    g->divider_gap = 4;
}

static bool game_init(Game *g) {
    if (SDL_Init(SDL_INIT_VIDEO) < 0) return false;
    if (IMG_Init(IMG_INIT_PNG) != IMG_INIT_PNG) return false;
    if (TTF_Init() < 0) return false;

    g->window = SDL_CreateWindow("Card Game",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        BASE_WINDOW_W, BASE_WINDOW_H, 0);
    if (!g->window) return false;

    g->renderer = SDL_CreateRenderer(g->window, -1,
        SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (!g->renderer) return false;

    compute_layout(g);

    g->font_title = TTF_OpenFont("fonts/Cinzel.ttf", 14);
    if (!g->font_title) return false;
    g->font_title_sm = TTF_OpenFont("fonts/Cinzel.ttf", 10);
    if (!g->font_title_sm) return false;
    g->font_body = TTF_OpenFont("fonts/CrimsonText-Regular.ttf", 11);
    if (!g->font_body) return false;
    g->font_body_italic = TTF_OpenFont("fonts/CrimsonText-Italic.ttf", 11);
    if (!g->font_body_italic) g->font_body_italic = g->font_body;
    g->font_small = TTF_OpenFont("fonts/CrimsonText-Regular.ttf", 10);
    if (!g->font_small) g->font_small = g->font_body;
    g->font_value = TTF_OpenFont("fonts/Cinzel.ttf", 16);
    if (!g->font_value) g->font_value = g->font_title;

    SDL_Surface *surf = IMG_Load("cards.png");
    if (!surf) return false;
    g->atlas_w = surf->w;
    g->atlas_h = surf->h;
    g->cell_w = g->atlas_w / CARD_ATLAS_COLS;
    g->cell_h = g->atlas_h / CARD_ATLAS_ROWS;
    g->atlas = SDL_CreateTextureFromSurface(g->renderer, surf);
    SDL_FreeSurface(surf);
    if (!g->atlas) return false;

    surf = IMG_Load("table.png");
    if (surf) {
        g->table = SDL_CreateTextureFromSurface(g->renderer, surf);
        SDL_FreeSurface(surf);
    }

    surf = IMG_Load("card-front-chrome.png");
    if (!surf) return false;
    g->card_front_chrome = SDL_CreateTextureFromSurface(g->renderer, surf);
    SDL_FreeSurface(surf);
    if (!g->card_front_chrome) return false;
    SDL_SetTextureBlendMode(g->card_front_chrome, SDL_BLENDMODE_BLEND);

    surf = IMG_Load("card-back.png");
    if (!surf) return false;
    g->card_back = SDL_CreateTextureFromSurface(g->renderer, surf);
    SDL_FreeSurface(surf);
    if (!g->card_back) return false;

    g->hand_count = 0;
    g->row_count = 0;
    g->dragging = false;
    g->running = true;
    return true;
}

static void game_cleanup(Game *g) {
    if (g->card_back) SDL_DestroyTexture(g->card_back);
    if (g->card_front_chrome) SDL_DestroyTexture(g->card_front_chrome);
    if (g->table) SDL_DestroyTexture(g->table);
    if (g->atlas) SDL_DestroyTexture(g->atlas);
    if (g->font_value && g->font_value != g->font_title) TTF_CloseFont(g->font_value);
    if (g->font_small && g->font_small != g->font_body) TTF_CloseFont(g->font_small);
    if (g->font_body_italic && g->font_body_italic != g->font_body) TTF_CloseFont(g->font_body_italic);
    if (g->font_body) TTF_CloseFont(g->font_body);
    if (g->font_title_sm) TTF_CloseFont(g->font_title_sm);
    if (g->font_title) TTF_CloseFont(g->font_title);
    if (g->renderer) SDL_DestroyRenderer(g->renderer);
    if (g->window) SDL_DestroyWindow(g->window);
    IMG_Quit();
    TTF_Quit();
    SDL_Quit();
}

static void fill_rect(SDL_Renderer *r, const SDL_Rect *rect, Uint8 R, Uint8 G, Uint8 B) {
    SDL_SetRenderDrawColor(r, R, G, B, 255);
    SDL_RenderFillRect(r, rect);
}

static void render_text_wordwrapped(SDL_Renderer *r, TTF_Font *font, const char *text,
                                    SDL_Color color, int x, int y, int max_w, int max_h) {
    if (!text || !*text) return;

    int cur_x = x;
    int cur_y = y;
    char buf[512];
    strncpy(buf, text, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    int spw, sph;
    TTF_SizeText(font, " ", &spw, &sph);

    char *word = strtok(buf, " ");
    while (word && cur_y < y + max_h) {
        int ww, wh;
        TTF_SizeText(font, word, &ww, &wh);

        if (cur_x + ww > x + max_w && cur_x > x) {
            cur_x = x;
            cur_y += wh + 2;
            if (cur_y >= y + max_h) break;
        }

        SDL_Surface *ws = TTF_RenderText_Blended(font, word, color);
        if (ws) {
            SDL_Texture *wt = SDL_CreateTextureFromSurface(r, ws);
            SDL_Rect dst = {cur_x, cur_y, ws->w, ws->h};
            SDL_RenderCopy(r, wt, NULL, &dst);
            SDL_DestroyTexture(wt);
            SDL_FreeSurface(ws);
        }

        cur_x += ww + spw;
        word = strtok(NULL, " ");
    }
}

static void draw_card(Game *g, int card_idx, int x, int y, bool face_up) {
    SDL_Renderer *r = g->renderer;
    int cw = g->card_w, ch = g->card_h;
    SDL_Rect dst = {x, y, cw, ch};

    SDL_Rect shadow = {x + 5, y + 7, cw, ch};
    SDL_SetRenderDrawColor(r, 13, 10, 8, 150);
    SDL_RenderFillRect(r, &shadow);

    if (!face_up) {
        SDL_RenderCopy(r, g->card_back, NULL, &dst);
        return;
    }

    SDL_SetRenderDrawColor(r, 38, 25, 24, 255);
    SDL_RenderFillRect(r, &dst);

    int col = card_idx % CARD_ATLAS_COLS;
    int row = card_idx / CARD_ATLAS_COLS;
    SDL_Rect src = {col * g->cell_w, row * g->cell_h, g->cell_w, g->cell_h};

    /* The atlas cells are square: render them 1:1, flush with the card edges. */
    SDL_Rect img_dst = {x, y, cw, cw};
    SDL_RenderCopy(r, g->atlas, &src, &img_dst);

    SDL_Rect lower = {x, y + cw, cw, ch - cw};
    SDL_SetRenderDrawColor(r, 218, 199, 157, 255);
    SDL_RenderFillRect(r, &lower);

    /* All ornamental chrome comes from a PNG asset. */
    SDL_RenderCopy(r, g->card_front_chrome, NULL, &dst);

    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_BLEND);
    SDL_Rect title_bg = {x, y + cw - 31, cw, 31};
    SDL_SetRenderDrawColor(r, 24, 13, 18, 205);
    SDL_RenderFillRect(r, &title_bg);
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_NONE);

    SDL_Color title_color = {245, 226, 174, 255};
    const char *title = g_cards[card_idx].title;
    int max_text_w = cw - 16;
    TTF_Font *tf = g->font_title;
    SDL_Surface *ts = TTF_RenderText_Blended(tf, title, title_color);
    if (ts && ts->w > max_text_w) {
        SDL_FreeSurface(ts);
        tf = g->font_title_sm;
        ts = TTF_RenderText_Blended(tf, title, title_color);
    }
    if (ts) {
        SDL_Texture *tt = SDL_CreateTextureFromSurface(r, ts);
        int tx = x + (cw - ts->w) / 2;
        SDL_Rect tdst = {tx, title_bg.y + (title_bg.h - ts->h) / 2, ts->w, ts->h};
        SDL_RenderCopy(r, tt, NULL, &tdst);
        SDL_DestroyTexture(tt);
        SDL_FreeSurface(ts);
    }

    int text_x = x + 13;
    int text_y = y + cw + 25;
    int text_w = cw - g->text_margin * 2;
    int text_h = ch - cw - 34;

    SDL_Color body_color = {50, 40, 30, 255};
    render_text_wordwrapped(r, g->font_body_italic, g_cards[card_idx].text,
                           body_color, text_x, text_y, text_w, text_h);

    char valbuf[8];
    snprintf(valbuf, sizeof(valbuf), "%d", g_cards[card_idx].value);
    SDL_Color badge_fg = {240, 235, 220, 255};

    int bs = g->badge_size;
    SDL_Rect badge = {x + cw - bs - 8, y + ch - bs - 7, bs, bs};

    SDL_SetRenderDrawColor(r, 80, 30, 30, 255);
    SDL_RenderFillRect(r, &badge);
    SDL_SetRenderDrawColor(r, 40, 20, 20, 255);
    SDL_RenderDrawRect(r, &badge);

    SDL_Surface *vs = TTF_RenderText_Blended(g->font_value, valbuf, badge_fg);
    if (vs) {
        SDL_Texture *vt = SDL_CreateTextureFromSurface(r, vs);
        SDL_Rect vdst = {badge.x + (bs - vs->w) / 2,
                        badge.y + (bs - vs->h) / 2, vs->w, vs->h};
        SDL_RenderCopy(r, vt, NULL, &vdst);
        SDL_DestroyTexture(vt);
        SDL_FreeSurface(vs);
    }
}

static void layout_hand(Game *g) {
    int total_w = g->hand_count * (g->card_w + g->card_gap) - g->card_gap;
    int start_x = (g->win_w - total_w) / 2;
    for (int i = 0; i < g->hand_count; i++) {
        g->hand[i].dst.x = (float)(start_x + i * (g->card_w + g->card_gap));
        g->hand[i].dst.y = (float)g->hand_y;
        g->hand[i].dst.w = g->card_w;
        g->hand[i].dst.h = g->card_h;
        g->hand[i].in_row = false;
    }
}

static void add_card_to_hand(Game *g, int card_idx) {
    if (g->hand_count >= MAX_HAND) return;
    g->hand[g->hand_count].card_idx = card_idx;
    g->hand[g->hand_count].in_row = false;
    g->hand_count++;
    layout_hand(g);
}

static void add_card_to_row(Game *g, int card_idx) {
    if (g->row_count >= 16) return;
    g->row_cards[g->row_count++] = card_idx;
}

static bool point_in_rect(float px, float py, const SDL_FRect *r) {
    return px >= r->x && px < r->x + r->w && py >= r->y && py < r->y + r->h;
}

static void handle_click(Game *g, float mx, float my) {
    if (g->dragging) return;

    for (int i = g->hand_count - 1; i >= 0; i--) {
        if (point_in_rect(mx, my, &g->hand[i].dst)) {
            g->dragging = true;
            g->drag_hand_idx = i;
            g->drag_off_x = mx - g->hand[i].dst.x;
            g->drag_off_y = my - g->hand[i].dst.y;
            g->drag_x = mx - g->drag_off_x;
            g->drag_y = my - g->drag_off_y;
            break;
        }
    }
}

static void handle_release(Game *g, float mx, float my) {
    (void)mx;
    if (!g->dragging) return;

    if (my < g->row_y + g->card_h + 20 && my > g->row_y - 20) {
        int ci = g->hand[g->drag_hand_idx].card_idx;
        add_card_to_row(g, ci);

        for (int i = g->drag_hand_idx; i < g->hand_count - 1; i++) {
            g->hand[i] = g->hand[i + 1];
        }
        g->hand_count--;
        layout_hand(g);
    }

    g->dragging = false;
}

static void draw_row(Game *g) {
    SDL_Renderer *r = g->renderer;

    SDL_Rect row_bg = {g->margin, g->row_y - 12, g->win_w - g->margin*2, g->card_h + 24};
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_BLEND);
    SDL_SetRenderDrawColor(r, 17, 25, 22, 105);
    SDL_RenderFillRect(r, &row_bg);
    SDL_SetRenderDrawColor(r, 182, 145, 72, 95);
    SDL_RenderDrawLine(r, row_bg.x, row_bg.y, row_bg.x + row_bg.w, row_bg.y);
    SDL_RenderDrawLine(r, row_bg.x, row_bg.y + row_bg.h, row_bg.x + row_bg.w, row_bg.y + row_bg.h);
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_NONE);

    int total_w = g->row_count * (g->card_w + g->card_gap) - g->card_gap;
    if (total_w < 0) total_w = 0;
    int sx = (g->win_w - total_w) / 2;
    for (int i = 0; i < g->row_count; i++) {
        draw_card(g, g->row_cards[i], sx + i * (g->card_w + g->card_gap), g->row_y, true);
    }
}

static void draw_hand(Game *g) {
    SDL_Renderer *r = g->renderer;

    SDL_Rect hand_bg = {g->margin, g->hand_y - 12, g->win_w - g->margin*2, g->card_h + 24};
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_BLEND);
    SDL_SetRenderDrawColor(r, 17, 20, 18, 125);
    SDL_RenderFillRect(r, &hand_bg);
    SDL_SetRenderDrawColor(r, 182, 145, 72, 95);
    SDL_RenderDrawLine(r, hand_bg.x, hand_bg.y, hand_bg.x + hand_bg.w, hand_bg.y);
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_NONE);

    for (int i = 0; i < g->hand_count; i++) {
        if (g->dragging && i == g->drag_hand_idx) continue;
        draw_card(g, g->hand[i].card_idx,
            (int)g->hand[i].dst.x, (int)g->hand[i].dst.y, true);
    }
}

static void draw_drag(Game *g) {
    if (!g->dragging) return;
    draw_card(g, g->hand[g->drag_hand_idx].card_idx,
        (int)g->drag_x, (int)g->drag_y, true);
}

static void draw_deck(Game *g) {
    int remaining = 64 - g->hand_count - g->row_count;
    if (remaining <= 0) return;

    int x = g->win_w - g->card_w - 26;
    int y = 62;
    for (int i = 0; i < 4; i++) {
        SDL_Rect edge = {x - i * 2, y + i * 3, g->card_w, g->card_h};
        SDL_SetRenderDrawColor(g->renderer, 198, 181, 142, 255);
        SDL_RenderFillRect(g->renderer, &edge);
        SDL_SetRenderDrawColor(g->renderer, 57, 39, 29, 255);
        SDL_RenderDrawRect(g->renderer, &edge);
    }
    draw_card(g, 0, x - 8, y, false);

    char label[32];
    snprintf(label, sizeof(label), "DOSSIER  %02d", remaining);
    SDL_Color gold = {225, 196, 126, 255};
    SDL_Surface *s = TTF_RenderText_Blended(g->font_title_sm, label, gold);
    if (s) {
        SDL_Texture *t = SDL_CreateTextureFromSurface(g->renderer, s);
        SDL_Rect d = {x + (g->card_w - s->w) / 2 - 8, y + g->card_h + 12, s->w, s->h};
        SDL_RenderCopy(g->renderer, t, NULL, &d);
        SDL_DestroyTexture(t);
        SDL_FreeSurface(s);
    }
}

static void draw_ui(Game *g) {
    SDL_Renderer *r = g->renderer;

    SDL_SetRenderDrawColor(r, 30, 24, 19, 255);
    SDL_RenderClear(r);
    if (g->table) {
        SDL_Rect table_dst = {0, 0, g->win_w, g->win_h};
        SDL_RenderCopy(r, g->table, NULL, &table_dst);
    }

    SDL_Rect title = {0, 0, g->win_w, g->title_bar_h};
    fill_rect(r, &title, 24, 16, 19);
    SDL_SetRenderDrawColor(r, 169, 126, 52, 255);
    SDL_RenderDrawLine(r, 0, g->title_bar_h - 1, g->win_w, g->title_bar_h - 1);
    SDL_Color white = {233, 212, 159, 255};
    SDL_Surface *ts = TTF_RenderText_Blended(g->font_title, "THE HIDDEN ARCHIVE", white);
    if (ts) {
        SDL_Texture *tt = SDL_CreateTextureFromSurface(r, ts);
        SDL_Rect td = {8, 6, ts->w, ts->h};
        SDL_RenderCopy(r, tt, NULL, &td);
        SDL_DestroyTexture(tt);
        SDL_FreeSurface(ts);
    }

    char info[128];
    snprintf(info, sizeof(info), "Hand: %d  |  Row: %d  |  Deck: %d  |  [D] Deal  [ESC] Quit",
        g->hand_count, g->row_count, 64 - g->hand_count - g->row_count);
    SDL_Color dgray = {197, 181, 146, 255};
    SDL_Surface *is = TTF_RenderText_Blended(g->font_small, info, dgray);
    if (is) {
        SDL_Texture *it = SDL_CreateTextureFromSurface(r, is);
        SDL_Rect id = {g->win_w - is->w - 20, 8, is->w, is->h};
        SDL_RenderCopy(r, it, NULL, &id);
        SDL_DestroyTexture(it);
        SDL_FreeSurface(is);
    }

    draw_row(g);
    draw_hand(g);
    draw_deck(g);
    draw_drag(g);

    SDL_RenderPresent(r);
}

static void init_deck(Game *g) {
    g->hand_count = 0;
    g->row_count = 0;

    bool used[64] = {false};
    for (int i = 0; i < 6; i++) {
        int idx;
        do { idx = SDL_GetTicks() % 64; SDL_Delay(1); } while (used[idx]);
        used[idx] = true;
        add_card_to_hand(g, idx);
    }
}

int main(int argc, char *argv[]) {
    (void)argc; (void)argv;

    Game game = {0};
    if (!game_init(&game)) {
        fprintf(stderr, "Init failed: %s\n", SDL_GetError());
        return 1;
    }

    init_deck(&game);

    while (game.running) {
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            switch (ev.type) {
            case SDL_QUIT:
                game.running = false;
                break;
            case SDL_MOUSEBUTTONDOWN:
                if (ev.button.button == SDL_BUTTON_LEFT)
                    handle_click(&game, (float)ev.button.x, (float)ev.button.y);
                break;
            case SDL_MOUSEBUTTONUP:
                if (ev.button.button == SDL_BUTTON_LEFT)
                    handle_release(&game, (float)ev.button.x, (float)ev.button.y);
                break;
            case SDL_MOUSEMOTION:
                if (game.dragging) {
                    game.drag_x = (float)ev.motion.x - game.drag_off_x;
                    game.drag_y = (float)ev.motion.y - game.drag_off_y;
                }
                break;
            case SDL_KEYDOWN:
                if (ev.key.keysym.sym == SDLK_ESCAPE) game.running = false;
                if (ev.key.keysym.sym == SDLK_d) {
                    int total = game.hand_count + game.row_count;
                    if (total < 64) {
                        bool used[64] = {false};
                        for (int i = 0; i < game.hand_count; i++) used[game.hand[i].card_idx] = true;
                        for (int i = 0; i < game.row_count; i++) used[game.row_cards[i]] = true;
                        int idx;
                        int attempts = 0;
                        do { idx = SDL_GetTicks() % 64; SDL_Delay(1); attempts++; }
                        while (used[idx] && attempts < 200);
                        if (!used[idx]) add_card_to_hand(&game, idx);
                    }
                }
                break;
            }
        }

        draw_ui(&game);
    }

    game_cleanup(&game);
    return 0;
}
