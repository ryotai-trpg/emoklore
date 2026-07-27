import { type CardMessage, ChatCardModel } from "./card-model";

const { NumberField } = foundry.data.fields;

/** カードの進み具合。まだ振っていなければ null */
export type AttackProgress = {
  successCount: number | null;
  damageTotal: number | null;
};

/** カードに載るロール。振っていない段は無い */
export type AttackRolls = {
  attackRoll?: foundry.dice.Roll | undefined;
  damageRoll?: foundry.dice.Roll | undefined;
};

/** カードのどのボタンが出るか。押せるかどうかの判定にも同じものを使う */
export type CardButtons = {
  canRollAttack: boolean;
  canRollDamage: boolean;
  canApplyDamage: boolean;
};

/**
 * カードの進み具合からボタンの出し分けを決める。
 *
 * 描画とアクション側のガードで同じ条件が要る。別々に書くと、片方だけ直したときに
 * 「押せるのに何も起きない」「押せないはずが実行される」という形でずれる。
 *
 * **`damageReady` に既定値を置かない。** ダメージを振れる条件はカードごとに違う（武器は
 * 命中していること、怪異はそこに判定なしと空のダメージ式が加わる）ので、既定を置くと
 * 共通の土台が片方の事情を持つことになり、渡し忘れたカードが黙って別のルールで動く。
 * カードごとの答えは各カードの `resolve*CardButtons` が1つだけ持ち、描画もモデルの
 * `buttons` もそこを通る。
 */
export const resolveCardButtons = (state: AttackProgress, damageReady: boolean): CardButtons => ({
  canRollAttack: state.successCount === null,
  canRollDamage: damageReady && state.damageTotal === null,
  // 適用は何度でも押せるようにしておく。狙いを変えて続けて当てることがある
  canApplyDamage: state.damageTotal !== null,
});

/**
 * 攻撃カードのChatMessageサブタイプの基底。
 *
 * 武器カードと怪異の攻撃カードは、どちらも「1枚のカードが育つ」形をしている。判定と
 * ダメージを同じメッセージに追記していくので、進み具合をメッセージ自身が持てるサブタイプが
 * 素直に噛み合う。その進み具合と、そこから決まるボタンの出し分けだけをここに置く。
 *
 * **`ACTIONS` をここで宣言しない。** `addListeners` は `this.constructor` から表を引くので
 * （`card-model.ts`）、サブクラスが自分の `ACTIONS` を持つ限りここの表は永久に呼ばれない。
 * 共有するのはハンドラの実体のほうで、`emoklore.ts` の init が両方の表へ登録する。
 * 共有ハンドラを `this: AttackCardModel` で書けるのは `this` 引数が反変だからで、
 * `CardActions<never>` と同じ理屈になる。
 */
export abstract class AttackCardModel extends ChatCardModel {
  declare successCount: number | null;
  declare damageTotal: number | null;

  /**
   * メッセージ自身を書き換えるボタンの `data-action`。
   *
   * 本体は**作成者にしか OWNER を返さない**（`ChatMessage#getUserLevel`）ので、これらは
   * 作成者とDL以外が押しても `message.update()` が通らない。ダメージ適用はここに入らない —
   * あちらはメッセージを書き換えず、権限が足りなければGMへ委譲する（`documents/queries.ts`）。
   *
   * **`ACTIONS` と違い、モジュール向けの拡張点ではない。** 2枚のカードが同じ1本を共有する
   * ので片方だけ足せず、そもそもボタンは保存済みの `content` に焼き込まれた要素なので、
   * ここに名前を足しても描く口が無い。
   */
  static readonly OWNER_ACTIONS: readonly string[] = ["rollAttack", "rollDamage"];

  static override defineSchema() {
    return {
      // まだ振っていなければ null。ボタンの出し分けはこの2つで決まる
      successCount: new NumberField({
        required: true,
        integer: true,
        nullable: true,
        initial: null,
      }),
      damageTotal: new NumberField({
        required: true,
        integer: true,
        nullable: true,
        initial: null,
      }),
    };
  }

  /** カードが載っているメッセージ。parent の型が DataModel 止まりなのでここで1回だけ絞る */
  get message(): CardMessage {
    return this.parent as CardMessage;
  }

  /**
   * 判定のロール。
   *
   * **`message.rolls` の添字を読むのはここだけ**にする。判定を振らないカード（怪異の
   * 判定なしの攻撃）では `rolls[0]` がダメージになるので、他所で添字を書くとダメージを
   * 判定として扱ってしまう。そのカードは `undefined` を返すよう上書きする。
   */
  get attackRoll(): foundry.dice.Roll | undefined {
    return this.message.rolls[0];
  }

  /**
   * ボタンの出し分け。
   *
   * ダメージを振れる条件がカードごとに違うので、実体はサブクラスが持つ。**描画側が呼ぶ
   * `resolve*CardButtons` と同じものを返すこと** — 別々に書くと、片方だけ直したときに
   * 「押せるのに何も起きない」形でずれる。
   */
  abstract get buttons(): CardButtons;

  /**
   * 配線に加えて、押しても通らないボタンを落とす。
   *
   * **`content` は作成者のクライアントが描いて保存した1本のHTML**なので、全員に同じものが
   * 届く。テンプレートでは見る人によって出し分けられず、描画のたびに走るここで落とすしかない。
   *
   * 効いてくるのは怪異の攻撃カードで、DLが出したものを卓の全員が見る。落とさないと
   * プレイヤーの画面に押せない〔判定〕〔ダメージ〕が並び、押すと権限エラーの通知が出る。
   * 武器カードでも同じ経路を通るが、あちらは押すのが作成者本人なので普段は何も起きない。
   */
  override addListeners(html: HTMLElement): void {
    super.addListeners(html);

    if (this.message.isOwner) return;

    const cls = this.constructor as typeof AttackCardModel;
    const card = html.querySelector(cls.CARD.root);
    if (!card) return;

    const selector = cls.OWNER_ACTIONS.map((action) => `[data-action="${action}"]`).join(",");
    for (const button of card.querySelectorAll(selector)) {
      const row = button.parentElement;
      button.remove();
      // 空になったボタンの行は間隔だけが残るので畳む
      if (row && row.childElementCount === 0) row.remove();
    }
  }
}

/** 名前付きの組を、メッセージに載せる平坦な配列にする。振っていない段は落とす */
export const flattenRolls = ({ attackRoll, damageRoll }: AttackRolls): foundry.dice.Roll[] =>
  [attackRoll, damageRoll].filter((roll): roll is foundry.dice.Roll => roll !== undefined);
