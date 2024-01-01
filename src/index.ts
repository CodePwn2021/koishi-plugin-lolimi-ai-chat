import { Context, Schema } from 'koishi'

export const name = 'lolimi-chat-ai';

export const usage = '接口来自桑帛云 (https://api.lolimi.cn)\n权限说明：获取用户的权限等级需要用到database服务';

export const inject = ['database'];

export interface Config {
  chatRole: ChatRole,
  usePrefixTriggerInChannel: boolean,
  prefix: string,
  authority: KoishiAuthority
}

enum ChatRole {
  JinFeng,
  MoMo
}

enum KoishiAuthority {
  ALL_USER = 1,
  PRO_USER,
  ADMIN,
  PRO_ADMIN,
  OWNER
}

interface LolimiApiResponse {
  code: number,
  data: {
    output: string,
    content: string
  }
}

export const Config: Schema<Config> = Schema.object({
  chatRole: Schema.union([
    Schema.const(ChatRole.JinFeng).description('婧枫（傲娇姐姐）'),
    Schema.const(ChatRole.MoMo).description('沫沫（软萌妹妹）'),
  ]).default(ChatRole.JinFeng).description('聊天角色'),
  usePrefixTriggerInChannel: Schema.boolean().default(false).description('是否允许在频道（QQ群用户请理解成群聊）内以特定前缀触发聊天（也就是无需指令的方式），注意：私聊场景默认开启特定前缀触发聊天'),
  prefix: Schema.string().default('chat').description('触发聊天所需要使用的前缀，聊天时前缀会被去除'),
  authority: Schema.union([
    Schema.const(KoishiAuthority.ALL_USER).description('全部用户 (1)'),
    Schema.const(KoishiAuthority.PRO_USER).description('高级用户 (2)'),
    Schema.const(KoishiAuthority.ADMIN).description('管理员 (3)'),
    Schema.const(KoishiAuthority.PRO_ADMIN).description('高级管理员 (4)'),
    Schema.const(KoishiAuthority.OWNER).description('所有者 (5)'),
  ]).default(KoishiAuthority.OWNER).description('触发聊天/使用本插件指令所需要的最低权限等级，可参考[Koishi文档-深入定制机器人-用户权限](https://koishi.chat/zh-CN/manual/usage/customize.html#%E7%94%A8%E6%88%B7%E6%9D%83%E9%99%90)')
});

export function apply(ctx: Context, config: Config) {
  ctx.middleware(async (session, next) => {
    if ((session.isDirect || config.usePrefixTriggerInChannel) && session.content.startsWith(config.prefix)) {
      // 内容不可为空
      const messageWithoutPrefix = session.content.replace(config.prefix, '');
      if (messageWithoutPrefix === '') return next();

      // 为什么后面再判断权限？这是为了减少数据库查询次数，减缓压力
      const user = await ctx.database.getUser(session.platform, session.userId);
      if ((user.authority >= config.authority)) {
        await session.send(`<quote id="${session.messageId}"/>${await requestReplyFromApi(ctx, config.chatRole, messageWithoutPrefix)}`);
      }
    }

    return next();
  });

  ctx.command('lolimi-chat <message:text>', '桑帛云AI聊天', {
    authority: config.authority
  }).example('lolimi-chat 你好').action(async (_, message) => {
    if (message === undefined || message === '') return '聊天内容不可为空';

    return `<quote id="${_.session.messageId}"/>${await requestReplyFromApi(ctx, config.chatRole, message)}`;
  });
}

async function requestReplyFromApi(ctx: Context, chatRole: ChatRole, message: string): Promise<string> {
  let targetUrl: string;
  switch (chatRole) {
    case ChatRole.JinFeng:
      targetUrl = 'https://api.lolimi.cn/API/AI/jj.php';
      break;
    case ChatRole.MoMo:
      targetUrl = 'https://api.lolimi.cn/API/AI/mm.php';
      break;
  }
  const response: LolimiApiResponse = await ctx.http.get(`${targetUrl}?msg=${message}`);
  if (response.code !== 200) {
    return '请求API失败，请重试';
  }
  return response.data.output;
}
