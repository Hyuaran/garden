/** Garden と FileMaker 共通。必要な時だけ生成し、DB に保存しない。 */
export function initialPassword(birthday: string | null | undefined) {
  if (!birthday) return null;
  const [, month, day] = birthday.split("-");
  return month && day ? `gd${month}${day}` : null;
}
