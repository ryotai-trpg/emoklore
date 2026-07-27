import { canRollDamage } from "../../rules/weapon-damage";
import { ChatCardModel } from "./card-model";

const { NumberField } = foundry.data.fields;

/**
 * カードが載っている ChatMessage。
 *
 * `parent` は本体の型では DataModel 止まりで、ChatMessage のメンバーが出てこない。
 * 実際に使うものだけを交差型で補う（docs/code-design.md「本体の型が足りないとき」）。
 */
export type CardMessage = ChatMessage & {
  rolls: foundry.dice.Roll[];
  update: (data: Record<string, unknown>) => Promise<unknown>;
};

/** カードの進み具合。まだ振っていなければ null */
export type AttackProgress = {
  successCount: number | null;
  damageTotal: number | null;
};

/** カードに載るロール。振っていない段はまだ無い */
export type AttackRolls = {
  attackRoll: foundry.dice.Roll | undefined;
  damageRoll: foundry.dice.Roll | undefined;
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
 * @param damageReady ダメージを振れる段まで進んだか。既定は「命中している」＝成功数1以上。
 *   怪異は判定なしの攻撃とダメージ式の空を持つので、条件を `rules/kai-attack.ts` から渡す
 */
export const resolveCardButtons = (
  state: AttackProgress,
  damageReady: boolean = state.successCount !== null && canRollDamage(state.successCount),
): CardButtons => ({
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
export class AttackCardModel extends ChatCardModel {
  declare successCount: number | null;
  declare damageTotal: number | null;

  /**
   * メッセージ自身を書き換えるボタンの `data-action`。
   *
   * 本体は**作成者にしか OWNER を返さない**（`ChatMessage#getUserLevel`）ので、これらは
   * 作成者とDL以外が押しても `message.update()` が通らない。`ACTIONS` と同じくモジュールが
   * 足せるよう、表として持つ。ダメージ適用はここに入らない — あちらはメッセージを
   * 書き換えず、権限が足りなければGMへ委譲する（`documents/queries.ts`）。
   */
  static OWNER_ACTIONS: string[] = ["rollAttack", "rollDamage"];

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
   * 判定ロールを持つカードか。
   *
   * `message.rolls` の何番目が何かは、これで決まる。**添字を直に書かない** — 怪異の
   * 判定なしの攻撃は判定を振らないので、`rolls[0]` がダメージになる。
   */
  protected get hasAttackRoll(): boolean {
    return true;
  }

  get attackRoll(): foundry.dice.Roll | undefined {
    return this.hasAttackRoll ? this.message.rolls[0] : undefined;
  }

  get damageRoll(): foundry.dice.Roll | undefined {
    return this.message.rolls[this.hasAttackRoll ? 1 : 0];
  }

  /** ボタンの出し分け。描画側と同じ判定を使う */
  get buttons(): CardButtons {
    return resolveCardButtons(this);
  }

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

    for (const action of cls.OWNER_ACTIONS) {
      for (const button of card.querySelectorAll(`[data-action="${action}"]`)) {
        const row = button.parentElement;
        button.remove();
        // 空になったボタンの行は間隔だけが残るので畳む
        if (row && row.childElementCount === 0) row.remove();
      }
    }
  }
}

/** 名前付きの組を、メッセージに載せる平坦な配列にする。振っていない段は落とす */
export const flattenRolls = ({ attackRoll, damageRoll }: AttackRolls): foundry.dice.Roll[] =>
  [attackRoll, damageRoll].filter((roll): roll is foundry.dice.Roll => roll !== undefined);
