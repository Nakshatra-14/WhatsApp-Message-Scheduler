const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('./config.json')) {
    console.error('Error: config.json file not found!');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const contacts = JSON.parse(fs.readFileSync('contacts.json', 'utf8'));

const messageTemplatePath = path.join(__dirname, 'message.txt');
if (!fs.existsSync(messageTemplatePath)) {
    console.error('Error: message.txt file not found!');
    process.exit(1);
}
const messageTemplate = fs.readFileSync(messageTemplatePath, 'utf8');

const message = messageTemplate.replace('${year}', config.year);

const imagePath = path.join(__dirname, 'image.jpg');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('QR Code received. Please scan with your WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready! Connected to WhatsApp Web.');
    console.log(`Image sending is ${config.sendImage ? 'enabled' : 'disabled'}`);
    console.log(`Configured to send New Year ${config.year} wishes`);
    scheduleMessages();
});

client.on('auth_failure', (err) => {
    console.error('Authentication failed:', err);
});

client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
});

async function scheduleMessages() {
    try {
        const { month, day, hour, minute, second } = config.scheduledTime;
        const scheduleYear = config.year; 
        const date = new Date(scheduleYear, month, day, hour, minute, second);
        
        console.log(`Messages scheduled for: ${date.toString()}`);
        
        schedule.scheduleJob(date, async () => {
            console.log(`Starting to send New Year ${config.year} messages...`);
            
            let media;
            if (config.sendImage) {
                if (fs.existsSync(imagePath)) {
                    media = MessageMedia.fromFilePath(imagePath);
                } else {
                    console.warn('Image file not found! Sending text only...');
                    config.sendImage = false;
                }
            }
            
            for (const contact of contacts) {
                try {
                    const chatId = `${contact.number}@c.us`;
                    
                    if (config.sendImage && media) {
                        await client.sendMessage(chatId, media, { caption: message });
                        console.log(`Message with image sent to ${contact.name}`);
                    } else {
                        await client.sendMessage(chatId, message);
                        console.log(`Message sent to ${contact.name}`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Failed to send to ${contact.name}:`, error.message);
                }
            }
            
            console.log('Finished sending all messages');
        });
        
        console.log('Messages scheduled successfully');
    } catch (error) {
        console.error('Error in scheduleMessages:', error);
    }
}

console.log('Starting WhatsApp client...');
client.initialize().catch(err => console.error('Initialization error:', err));
