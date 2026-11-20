import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useLocale } from "@/lib/i18n";
import { C } from "@/lib/theme";
import { childrenOf, depthOf, MAX_DEPTH } from "@/lib/tree";
import type { Category } from "@/lib/types";

import { Plus } from "./icons";
import { Sheet } from "./sheet";
import { fontFor, Txt } from "./txt";

/**
 * The whole category tree, indented, in a bottom sheet. Tapping a name picks it (any level). With
 * `onCreate`, each category that can still hold a level has a small ＋ to make one inside it, and
 * "＋ 새 카테고리 생성" sits at the bottom; the new category is picked straight away. The name is typed in the sheet itself
 * (a second modal on top of a sheet does not open on iOS).
 * `blocked(id)` greys out places that cannot be chosen (e.g. moving a category into itself).
 */
export function CategoryPicker({
  visible,
  title,
  cats,
  value,
  noneLabel,
  onPick,
  onCreate,
  blocked,
  onClose,
  testID,
}: {
  visible: boolean;
  title: string;
  cats: Category[];
  value: string | null;
  noneLabel?: string;
  onPick: (id: string | null) => void;
  onCreate?: (name: string, parentId: string | null) => Promise<string | null>;
  blocked?: (id: string | null) => boolean;
  onClose: () => void;
  testID: string;
}) {
  const { t } = useLocale();
  // Where a new category is being named: a parent id, 'top', or nothing.
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const startAdd = (where: string) => {
    setDraft("");
    setAdding(where);
  };
  const create = async () => {
    const name = draft.trim();
    if (!onCreate || !adding || !name || busy) return;
    setBusy(true);
    const id = await onCreate(name, adding === "top" ? null : adding);
    setBusy(false);
    if (!id) return;
    setAdding(null);
    onPick(id);
  };
  const close = () => {
    setAdding(null);
    onClose();
  };
  const nameBox = (parentId: string | null, indent: number) => {
    const depth = parentId ? depthOf(cats, parentId) + 1 : 1;
    const placeholder =
      depth === 1
        ? "Orchid"
        : depth === 2
          ? "Bulbophyllum"
          : t("유묘", "Seedlings", "実生");
    return (
      <View
        style={[styles.row, { paddingLeft: 4 + indent * 22 }]}
        testID={`${testID}-new`}
      >
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={create}
          placeholder={t(
            `새 카테고리 이름 (예: ${placeholder})`,
            `New category name (e.g. ${placeholder})`,
            `新しいカテゴリ名（例：${placeholder}）`,
          )}
          placeholderTextColor="#A8A8A8"
          maxLength={40}
          returnKeyType="done"
          autoCorrect={false}
          style={[styles.input, fontFor(draft || "a")]}
          testID={`${testID}-new-input`}
        />
        <Pressable
          onPress={() => setAdding(null)}
          hitSlop={6}
          style={styles.small}
          accessibilityRole="button"
          testID={`${testID}-new-cancel`}
        >
          <Txt size={13} color={C.sub}>
            {t("취소", "Cancel", "キャンセル")}
          </Txt>
        </Pressable>
        <Pressable
          onPress={create}
          disabled={!draft.trim() || busy}
          hitSlop={6}
          style={[styles.small, (!draft.trim() || busy) && styles.off]}
          accessibilityRole="button"
          testID={`${testID}-new-ok`}
        >
          <Txt size={13} weight="bold">
            {t("생성", "Create", "作成")}
          </Txt>
        </Pressable>
      </View>
    );
  };
  const rows: { cat: Category; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of childrenOf(cats, parent)) {
      rows.push({ cat: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 1);
  const off = (id: string | null) => !!blocked?.(id);
  return (
    <Sheet visible={visible} title={title} onClose={close} testID={testID}>
      {noneLabel !== undefined && (
        <Pressable
          onPress={() => !off(null) && onPick(null)}
          disabled={off(null)}
          style={[styles.row, off(null) && styles.off]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === null }}
          testID={`${testID}-none`}
        >
          <Txt
            size={15}
            weight={value === null ? "bold" : "light"}
            color={C.sub}
            style={{ flex: 1 }}
          >
            {noneLabel}
          </Txt>
          {value === null && <Txt weight="bold">✓</Txt>}
        </Pressable>
      )}
      {rows.map(({ cat, depth }) => (
        <View key={cat.id}>
          <View style={[styles.row, { paddingLeft: 4 + (depth - 1) * 22 }]}>
            <Pressable
              onPress={() => !off(cat.id) && onPick(cat.id)}
              disabled={off(cat.id)}
              style={[
                { flex: 1, paddingVertical: 2 },
                off(cat.id) && styles.off,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: value === cat.id }}
              testID={`${testID}-pick-${cat.name}`}
            >
              <Txt
                size={depth === 1 ? 16 : 15}
                weight={value === cat.id || depth === 1 ? "bold" : "light"}
              >
                {cat.name}
              </Txt>
            </Pressable>
            {value === cat.id && (
              <Txt weight="bold" style={{ marginRight: 8 }}>
                ✓
              </Txt>
            )}
            {onCreate && depth < MAX_DEPTH && (
              <Pressable
                onPress={() => startAdd(cat.id)}
                hitSlop={8}
                style={styles.add}
                accessibilityRole="button"
                accessibilityLabel={t(
                  `${cat.name} 안에 카테고리 생성`,
                  `New category in ${cat.name}`,
                  `${cat.name}の中にカテゴリを作成`,
                )}
                testID={`${testID}-add-in-${cat.name}`}
              >
                <Plus size={18} color={C.sub} />
              </Pressable>
            )}
          </View>
          {adding === cat.id && nameBox(cat.id, depth)}
        </View>
      ))}
      {adding === "top" && nameBox(null, 0)}
      {onCreate && adding !== "top" && (
        <Pressable
          onPress={() => startAdd("top")}
          style={[styles.row, { borderBottomWidth: 0 }]}
          accessibilityRole="button"
          testID={`${testID}-add-top`}
        >
          <Plus size={18} />
          <Txt size={15} weight="bold" style={{ marginLeft: 8 }}>
            {t("새 카테고리 생성", "New category", "新しいカテゴリを作成")}
          </Txt>
        </Pressable>
      )}
      {!rows.length && !onCreate && (
        <Txt size={13} color={C.muted} style={{ paddingVertical: 16 }}>
          {t(
            "아직 카테고리가 없습니다.",
            "No categories yet.",
            "まだカテゴリがありません。",
          )}
        </Txt>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    paddingVertical: 8,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E6E6E6",
  },
  add: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  off: { opacity: 0.3 },
  input: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 0,
    color: C.ink,
    outlineWidth: 0,
  },
  small: { paddingHorizontal: 8, minHeight: 36, justifyContent: "center" },
});
