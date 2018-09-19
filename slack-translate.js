// Copyright (c) 2016 SYSTRAN S.A.
// Copyright (c) 2018 Ivinco LTD
// Copyright (c) 2018 Manticore Search LTD

class newSlackBot {
    constructor(token, botName) {
        const {RTMClient, WebClient} = require('@slack/client');
        const translateAPI = require('google-translate-api');
        this.fs = require('fs');

        this.rtm = new RTMClient(token);
        this.web = new WebClient(token);

        this.subscribedUsers = {};
        this.translateToLanguage = {};
        this.appPath = __dirname + '/subscribers_list.dat';

        this.rtm.start();
        this.getSubscribedUsers();

        this.rtm.on('message', (message) => {

            if ((message.subtype && message.subtype === 'bot_message') ||
                (!message.subtype && message.user === this.rtm.activeUserId)) {
                return;
            }

            let channel = message.channel;
            let type = message.type;
            let text = message.text;

            // Log the message
            console.log(`(channel:${channel}) message type: ${type} text: ${text}`);

            /* Handle commands */
            if (message.text != null && text.indexOf(botName) !== -1) {

                let words = text.split(' ');
                let command = words[1];

                if (command === 'subscribe' || command === 'translate') {
                    // WORDS[2] = [en, ru]
                    let lang = words[2];
                    if (translateAPI.languages.isSupported(lang)) {
                        this.subscribedUsers[message.user] = lang;
                        this.updateSubscribedUsers();
                        this.sendEphemeralMessage('You’re subscribed to translation into *' + lang + '*', channel, message.user);
                        this.recountLanguages();
                        console.log(message.user + ' subscribed to translator ' + lang);
                    }else {
                        this.sendEphemeralMessage('Language *' + lang + '* don\'t supported', channel, message.user);
                    }

                } else if (command === 'unsubscribe' || command === 'mute') {

                    if (this.subscribedUsers[message.user]) {
                        delete this.subscribedUsers[message.user];
                        this.updateSubscribedUsers();
                        this.sendEphemeralMessage('You’ve unsubscribed from all translations', channel, message.user);
                        this.recountLanguages();
                        console.log(message.user + ' unsubscribe');
                    } else {
                        this.sendEphemeralMessage('You don\'t subscribed to any translator', channel, message.user);
                    }

                } else if (command === 'help') {

                    this.web.chat.postMessage({
                        channel: channel,
                        text: "Here is the list of acceptable commands",
                        attachments: [
                            {
                                "text": "@translate *translate, subscribe <language>* - tells the bot that you want in the " +
                                "current channel to see translations of all foreign posts in <language>, " +
                                "only one language can be translated for the same requested\n " +
                                "@translate *unsubscribe, mute* - disable translate\n @translate *help* - show this list",
                                "mrkdwn_in": [
                                    "text",
                                    "pretext"
                                ]
                            }
                        ],

                        as_user: true
                    }).catch(console.error);
                }
                return;
            }

            if (type === 'message' && text && channel) {

                for (let language in this.translateToLanguage) {

                    if (this.translateToLanguage.hasOwnProperty(language)) {

                        translateAPI(text, {to: language})
                            .then(res => {
                                console.log('Google Translate output', res);

                                for (let user in this.subscribedUsers) {
                                    if (this.subscribedUsers.hasOwnProperty(user)) {
                                        if(message.user === user){
                                            continue;
                                        }
                                        if (language === this.subscribedUsers[user] &&
                                            res.from.language.iso !== this.subscribedUsers[user]) {

                                            this.sendEphemeralMessage(res.text, channel, user);
                                        }
                                    }
                                }
                                return false;
                            })
                            .catch(err => {
                                console.log(err);
                                return false;
                            });
                    }
                }

            } else {
                let error = '';
                error += type !== 'message' ? 'unexpected type ' + type + '. ' : '';
                error += !text ? 'text was undefined. ' : '';
                error += !channel ? 'channel was undefined.' : '';
                console.log('@ could not respond. ' + error);
            }
        });
    }

    getSubscribedUsers() {
        if (this.fs.existsSync(this.appPath)) {
            this.fs.readFile(this.appPath, 'utf8', (err, data) => {
                if (err) {
                    console.log(err);
                } else {
                    if (data.length > 0) {
                        this.subscribedUsers = JSON.parse(data);
                        this.recountLanguages();
                    }
                }
            });
        }
    }

    updateSubscribedUsers() {
        this.fs.writeFile(this.appPath, JSON.stringify(this.subscribedUsers), function () {
            
        });
    }

    sendEphemeralMessage(text, channel, user) {
        this.web.chat.postEphemeral({
            channel: channel,
            text: text,
            user: user,
            as_user: true
        }).then((res) => {
            console.log('Message sent: ', res);
        }).catch(console.error);
    }

    recountLanguages(){
        this.translateToLanguage = {};
        for (let user in this.subscribedUsers) {
            if (this.subscribedUsers.hasOwnProperty(user)) {
                this.translateToLanguage[this.subscribedUsers[user]] = true;
            }
        }
    }
}

let botToken = process.env.SLACK_TOKEN;
let botName = process.env.SLACK_BOT_NAME;

new newSlackBot(botToken, botName);
