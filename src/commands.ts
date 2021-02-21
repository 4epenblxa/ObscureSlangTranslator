import { Command, keyboardWithConfirmation, ObscureEntry, processReplenishment } from "./templates";
import { queries } from "./db/patterns";
import { QueryResult } from "pg";
import { texts } from "./texts";
import { bot } from "./app";
import { capitalize, formatAnswer, formatDBSize, formatUsername } from "./utils/formatting";
import { fuzzyFormat, fuzzySearch } from "./utils/fuzzySearch";
import { registerCallback } from "./inLineHandler";
import { hasRights, promoteUser } from "./utils/moderate";
import { format } from "util";

const db = require("./db");

export const commands: Command[] = [
    {
        command: '/size',
        regexp: /\/size/,
        description: 'Get last DB index',
        callback: (msg => {
            const chatId = msg.chat.id;
            db.query(queries.lastIndex).then((res: QueryResult) => {
                const reElement = res.rows[0];
                if (reElement)
                    bot.sendMessage(chatId, formatDBSize(reElement['max']));
                else
                    console.error("res.rows[0] is null: ", JSON.stringify(res));
            })
        })
    },

    {
        command: '/name',
        regexp: /^(\/add )?([a-zA-Z0-9_а-яА-Я]{2,})(?:(?:\s?-\s?)|\s+)([a-zA-Z0-9_а-яА-Я,.\-)( ]{2,})$/,
        description: 'Main upload command',
        callback: (msg, match) => {
            if (!match || !msg.from || (msg.chat.type !== 'private' && !match[1]))
                return;
            const chatId = msg.chat.id;
            const vars: string[] = capitalize([match[2], match[3]]);
            const fuzzy = fuzzySearch(vars);
            const entry: ObscureEntry = {
                id: -1, synonyms: [],
                term: <string>vars[0],
                value: <string>vars[1]
            };
            const upload = () => {
                processReplenishment(entry, msg.from ? formatUsername(msg.from) : '').then(value =>
                    bot.sendMessage(msg.chat.id, formatDBSize(value.rows[0].id)));
            }

            if (fuzzy) {
                const keyboard = keyboardWithConfirmation(upload, 'Force');
                bot.sendMessage(chatId, `Are you sure that this is not a duplicate for
*${formatAnswer(fuzzy)}*
If mistake, click \`Force\``, {
                    reply_markup: keyboard,
                    parse_mode: "MarkdownV2"
                }).then(answer => registerCallback(answer, keyboard));
            } else
                upload();
        }
    },

    {
        command: '/start',
        regexp: /\/start/,
        description: 'Welcome-Command',
        callback: (msg) => {
            bot.sendMessage(msg.chat.id, texts.welcome);
        }
    },
    {
        command: '/get',
        regexp: /\/get ([a-zA-Z0-9_а-яА-Я ]+)/,
        description: 'Get Fuzzy Terms',
        callback: (msg, match) => {
            bot.sendMessage(msg.chat.id, fuzzyFormat(match), {
                parse_mode: "MarkdownV2"
            });
        }
    },
    {
        command: '/promote',
        regexp: /\/promote/g,
        description: 'Promotes a user',
        callback: (msg) => {
            const promoterId = msg.from?.id;
            if (promoterId && hasRights(promoterId)) {
                if (msg.reply_to_message?.from && !msg.reply_to_message.from.is_bot) {
                    const promotable = msg.reply_to_message.from;
                    const keyboard = keyboardWithConfirmation(() =>
                        promoteUser(promotable.id, promoterId).then(() => {
                            bot.sendMessage(msg.chat.id, texts.successfulPromoting);
                            bot.sendMessage(promotable.id, texts.promoteAnnounce)
                                .catch(() => bot.sendMessage(msg.chat.id,
                                    `${promotable.username ? "@" : ""}${formatUsername(promotable)}, ` +
                                    texts.promoteAnnounce));

                        }).catch(e => bot.sendMessage(promoterId, e.stack)), 'Promote', promoterId);

                    bot.sendMessage(msg.chat.id, format(texts.confirmPromotion, `${promotable.username ? "@" : ""}${formatUsername(promotable)}`), {
                        reply_markup: keyboard
                    }).then(value => registerCallback(value, keyboard))
                } else
                    bot.sendMessage(msg.chat.id, texts.provideAUser, {
                        parse_mode: "MarkdownV2"
                    })
            } else bot.sendMessage(msg.chat.id, texts.hasNoRights);
        }
    }
];