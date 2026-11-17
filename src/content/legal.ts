// Draft texts for the beta. Have them reviewed before the store release and publish the same text on a
// web page (the stores require a privacy policy URL). Contact comes from EXPO_PUBLIC_CONTACT_EMAIL.
import type { Locale } from '@/lib/locale';

export const CONTACT = process.env.EXPO_PUBLIC_CONTACT_EMAIL || '';
const contact = (l: Locale) => CONTACT || { ko: '[운영자 연락처 입력 필요]', en: '[contact to be added]', ja: '[連絡先を記入]' }[l];
export const LEGAL_UPDATED = '2026-11-18';

export function termsText(l: Locale): string[] {
  if (l === 'en')
    return [
      'PLANT MATTER is a beta service for recording the plants you keep and the plants you find in the wild.',
      'You keep the rights to your photos, names and notes. We use them only to store and show them to you.',
      'Do not upload content that is illegal, harmful or infringes the rights of others. Such content may be removed.',
      'Collecting or exporting wild plants is governed by local law and CITES. The app never stores exact find locations.',
      'Features may change during the beta, and beta data may be reorganised. Keep copies of records that matter to you.',
      'You can delete your account at any time in OPTION → Account. All your records and photos are deleted with it.',
      `Contact: ${contact(l)}`,
    ];
  if (l === 'ja')
    return [
      'PLANT MATTERは、育てている植物と野外で見つけた植物を記録するベータ版サービスです。',
      '写真・名前・メモの権利は投稿者にあります。保存・表示に必要な範囲でのみ利用します。',
      '違法・有害な内容や他人の権利を侵害する内容は投稿しないでください。該当する内容は削除されることがあります。',
      '野生植物の採集・持ち出しは各国の法律やCITESに従ってください。アプリは正確な発見場所を保存しません。',
      'ベータ期間中は機能が変わったりデータが整理されたりすることがあります。大切な記録は別に保管してください。',
      'アカウントはOPTION → Accountからいつでも削除でき、記録と写真もすべて削除されます。',
      `お問い合わせ：${contact(l)}`,
    ];
  return [
    'PLANT MATTER는 내가 키우는 식물과 야생에서 발견한 식물을 기록하는 베타 서비스입니다.',
    '사진·이름·메모의 권리는 작성자에게 있습니다. 저장하고 보여 주는 데 필요한 범위에서만 사용합니다.',
    '불법·유해하거나 다른 사람의 권리를 침해하는 내용은 올리지 마세요. 이런 내용은 삭제될 수 있습니다.',
    '야생 식물 채집·반출은 각 나라의 법과 CITES를 따라야 합니다. 앱은 정확한 발견 위치를 저장하지 않습니다.',
    '베타 기간에는 기능이 바뀌거나 데이터가 정리될 수 있습니다. 중요한 기록은 따로 보관해 주세요.',
    '계정은 OPTION → Account에서 언제든 삭제할 수 있고, 삭제하면 기록과 사진도 모두 지워집니다.',
    `문의: ${contact(l)}`,
  ];
}

export function privacyText(l: Locale): string[] {
  if (l === 'en')
    return [
      'What we collect: your e-mail address, display name, the plants and finds you record (name, notes, country, date, category, origin, parents) and their photos.',
      'Location: the app does not use GPS. Photos are re-encoded on your phone before upload, which removes location data embedded in them. Finds keep the country only.',
      'Why: to sign you in and to store and show your records.',
      'Who can see it: in this version only you can see your plants and finds. Events and shops posted by PLANT MATTER are public.',
      'Where it is stored: Supabase (database and file storage) in the region chosen for the project.',
      'How long: until you delete it. Deleting your account removes your records and photos at once.',
      `Your rights and questions: edit or delete records in the app, delete your account in OPTION → Account, or contact ${contact(l)}.`,
      `Last updated: ${LEGAL_UPDATED}`,
    ];
  if (l === 'ja')
    return [
      '収集する情報：メールアドレス、表示名、記録した植物・発見記録（名前、メモ、国、日付、分類、原産地、親株）と写真。',
      '位置情報：GPSは使用しません。写真はアップロード前に端末で再保存され、埋め込まれた位置情報は削除されます。発見記録は国のみ保存します。',
      '目的：ログインと、記録の保存・表示のため。',
      '公開範囲：このバージョンでは植物と発見記録は本人のみが閲覧できます。PLANT MATTERが掲載するイベント・ショップ情報は公開されます。',
      '保存先：Supabase（データベース・ファイル保存）、プロジェクトで選んだリージョン。',
      '保存期間：削除するまで。アカウントを削除すると記録と写真はすぐに削除されます。',
      `権利とお問い合わせ：アプリで記録の修正・削除、OPTION → Accountでアカウント削除ができます。お問い合わせ：${contact(l)}`,
      `最終更新：${LEGAL_UPDATED}`,
    ];
  return [
    '수집하는 정보: 이메일, 표시 이름, 내가 기록한 식물·발견 기록(이름, 메모, 나라, 날짜, 분류, 원산지, 모본·부본)과 사진.',
    '위치 정보: 앱은 GPS를 쓰지 않습니다. 사진은 올리기 전에 휴대폰에서 다시 저장되며, 이때 사진 속 위치 정보가 지워집니다. 발견 기록에는 나라만 저장합니다.',
    '목적: 로그인과 기록의 저장·표시.',
    '공개 범위: 이번 버전에서는 내 식물과 발견 기록을 나만 볼 수 있습니다. PLANT MATTER가 올리는 행사·매장 정보는 누구나 볼 수 있습니다.',
    '보관 위치: Supabase(데이터베이스·파일 저장), 프로젝트에서 고른 리전.',
    '보관 기간: 직접 지울 때까지. 계정을 삭제하면 기록과 사진이 바로 삭제됩니다.',
    `권리와 문의: 앱에서 기록 수정·삭제, OPTION → Account에서 계정 삭제가 가능합니다. 문의: ${contact(l)}`,
    `최종 수정일: ${LEGAL_UPDATED}`,
  ];
}
