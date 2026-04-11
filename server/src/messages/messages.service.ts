import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';
import { ContactsService } from '../contacts/contacts.service';

@Injectable()
export class MessagesService {
  private eventCallback: (event: string, data: any) => void;

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private contactsService: ContactsService,
  ) {}

  setEventCallback(cb: (event: string, data: any) => void) {
    this.eventCallback = cb;
  }

  private emit(event: string, data: any) {
    if (this.eventCallback) this.eventCallback(event, data);
  }

  async getConversations(): Promise<any[]> {
    const convos = await this.conversationModel
      .find()
      .sort({ lastMessageAt: -1 })
      .lean()
      .exec();

    const enriched = await Promise.all(
      convos.map(async (c) => {
        const contactName = await this.contactsService.resolveContactName(c.phoneNumber);
        return { ...c, contactName };
      }),
    );

    return enriched;
  }

  async searchMessages(query: string, limit = 20): Promise<any[]> {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const messages = await this.messageModel
      .find({ body: { $regex: regex } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const convoMap = new Map<string, any[]>();
    for (const msg of messages) {
      const cid = (msg as any).conversation.toString();
      if (!convoMap.has(cid)) convoMap.set(cid, []);
      convoMap.get(cid)!.push({ _id: msg._id, body: msg.body, createdAt: (msg as any).createdAt, direction: msg.direction });
    }

    const convoIds = [...convoMap.keys()];
    const convos = await this.conversationModel
      .find({ _id: { $in: convoIds } })
      .lean()
      .exec();

    return Promise.all(convos.map(async (c) => {
      const contactName = await this.contactsService.resolveContactName(c.phoneNumber);
      return { ...c, contactName, matchingMessages: convoMap.get(c._id.toString()) || [] };
    }));
  }

  async getMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
    const query: any = { conversation: new Types.ObjectId(conversationId) };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    return this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getOrCreateConversation(phoneNumber: string): Promise<Conversation> {
    let convo = await this.conversationModel.findOne({ phoneNumber }).exec();
    if (!convo) {
      const contact = await this.contactsService.findByPhone(phoneNumber);
      convo = await this.conversationModel.create({
        phoneNumber,
        contact: contact?._id,
        lastMessageAt: new Date(),
      });
    }
    return convo;
  }

  async receiveMessage(data: {
    from: string;
    to: string;
    body: string;
    mediaUrls?: string[];
    twilioSid: string;
  }): Promise<Message> {
    const convo = await this.getOrCreateConversation(data.from);

    const message = await this.messageModel.create({
      conversation: convo._id,
      direction: 'inbound',
      from: data.from,
      to: data.to,
      body: data.body,
      mediaUrls: data.mediaUrls || [],
      twilioSid: data.twilioSid,
      status: 'received',
    });

    await this.conversationModel.findByIdAndUpdate(convo._id, {
      lastMessageBody: data.body,
      lastMessageAt: new Date(),
      $inc: { unreadCount: 1 },
    });

    const contactName = await this.contactsService.resolveContactName(data.from);
    this.emit('message:received', { message, conversationId: convo._id, contactName });

    return message;
  }

  async sendMessage(data: {
    to: string;
    body: string;
    from: string;
    mediaUrls?: string[];
    twilioSid: string;
  }): Promise<Message> {
    const convo = await this.getOrCreateConversation(data.to);

    const message = await this.messageModel.create({
      conversation: convo._id,
      direction: 'outbound',
      from: data.from,
      to: data.to,
      body: data.body,
      mediaUrls: data.mediaUrls || [],
      twilioSid: data.twilioSid,
      status: 'sent',
    });

    await this.conversationModel.findByIdAndUpdate(convo._id, {
      lastMessageBody: data.body,
      lastMessageAt: new Date(),
    });

    this.emit('message:sent', { message, conversationId: convo._id });

    return message;
  }

  async getMessagesByPhone(phoneNumber: string, limit = 50): Promise<any> {
    const convo = await this.conversationModel.findOne({ phoneNumber }).lean().exec();
    if (!convo) return [];
    return this.messageModel
      .find({ conversation: convo._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async markConversationRead(conversationId: string): Promise<any> {
    await this.conversationModel.findByIdAndUpdate(conversationId, { unreadCount: 0 });
    return { ok: true };
  }
}
