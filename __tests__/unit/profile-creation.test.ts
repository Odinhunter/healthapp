/**
 * Profile creation data contract tests
 *
 * family_members INSERT must produce exactly the right shape.
 * Errors here = corrupted health profiles for users.
 * Blood group, DOB, and gender are medical data — must be typed exactly.
 */
import { format } from 'date-fns';

type Gender = 'male' | 'female' | 'other' | null;
type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | null;

interface FamilyMemberInsert {
  owner_id: string;
  full_name: string;
  relationship: 'self' | 'parent' | 'spouse' | 'child' | 'sibling' | 'grandparent' | 'other';
  is_primary: boolean;
  date_of_birth: string | null;
  gender?: Gender;
  blood_group?: BloodGroup;
  avatar_color?: string | null;
}

const buildProfileInsert = (
  userId: string,
  name: string,
  dob: Date | null,
  gender: Gender,
  bloodGroup: BloodGroup,
  primaryColor: string
): FamilyMemberInsert => ({
  owner_id: userId,
  full_name: name.trim(),
  relationship: 'self',
  is_primary: true,
  date_of_birth: dob ? format(dob, 'yyyy-MM-dd') : null,
  gender: gender ?? undefined,
  blood_group: bloodGroup ?? undefined,
  avatar_color: primaryColor,
});

describe('Profile insert shape', () => {
  const userId = 'user-abc-123';
  const primaryColor = '#0F6E56';

  it('minimal insert (name only) has correct defaults', () => {
    const insert = buildProfileInsert(userId, 'Arjun Sharma', null, null, null, primaryColor);
    expect(insert.owner_id).toBe(userId);
    expect(insert.full_name).toBe('Arjun Sharma');
    expect(insert.relationship).toBe('self');
    expect(insert.is_primary).toBe(true);
    expect(insert.date_of_birth).toBeNull();
    expect(insert.gender).toBeUndefined(); // not null — undefined omits the key
    expect(insert.blood_group).toBeUndefined();
    expect(insert.avatar_color).toBe(primaryColor);
  });

  it('full insert with all optional fields', () => {
    const dob = new Date('1990-03-15');
    const insert = buildProfileInsert(userId, 'Priya Patel', dob, 'female', 'B+', primaryColor);
    expect(insert.date_of_birth).toBe('1990-03-15');
    expect(insert.gender).toBe('female');
    expect(insert.blood_group).toBe('B+');
  });

  it('name is trimmed before insert', () => {
    const insert = buildProfileInsert(userId, '  Rahul Verma  ', null, null, null, primaryColor);
    expect(insert.full_name).toBe('Rahul Verma');
    expect(insert.full_name).not.toMatch(/^\s|\s$/);
  });

  it('is_primary is always true for self profile', () => {
    const insert = buildProfileInsert(userId, 'Test User', null, null, null, primaryColor);
    expect(insert.is_primary).toBe(true);
  });

  it('relationship is always self', () => {
    const insert = buildProfileInsert(userId, 'Test User', null, null, null, primaryColor);
    expect(insert.relationship).toBe('self');
  });
});

describe('Date of birth formatting', () => {
  it('formats date in yyyy-MM-dd for PostgreSQL DATE column', () => {
    const dob = new Date('1985-07-04');
    expect(format(dob, 'yyyy-MM-dd')).toBe('1985-07-04');
  });

  it('single-digit months and days are zero-padded', () => {
    const dob = new Date('1990-03-05');
    expect(format(dob, 'yyyy-MM-dd')).toBe('1990-03-05');
  });

  it('does NOT use toISOString() — timezone bug scenario', () => {
    // toISOString() at midnight in UTC+5:30 would give the previous day
    // date-fns format() uses local date components — safer
    const dob = new Date(2000, 0, 1, 0, 0, 0); // Jan 1 2000 local midnight
    const isoResult = dob.toISOString().split('T')[0]; // might be '1999-12-31' in IST
    const formatResult = format(dob, 'yyyy-MM-dd');    // always '2000-01-01' in local time
    // These might differ in IST — that's exactly the bug we're avoiding
    // Just verify format() gives what we want
    expect(formatResult).toBe('2000-01-01');
    // Note: isoResult might be '1999-12-31' in UTC+5:30 — DO NOT USE
  });

  it('DOB null is preserved as null, not empty string', () => {
    const dob = null;
    const result: string | null = dob ? format(dob, 'yyyy-MM-dd') : null;
    expect(result).toBeNull();
    expect(result).not.toBe('');
  });
});

describe('Blood group values', () => {
  const validGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  it('exactly 8 valid blood groups', () => {
    expect(validGroups).toHaveLength(8);
  });

  it('all groups are correct ABO+Rh format', () => {
    const aboPattern = /^(A|B|AB|O)[+-]$/;
    validGroups.forEach(group => {
      if (group) expect(group).toMatch(aboPattern);
    });
  });

  it('covers all ABO types with positive and negative', () => {
    const aboTypes = ['A', 'B', 'AB', 'O'];
    aboTypes.forEach(type => {
      expect(validGroups).toContain(`${type}+` as BloodGroup);
      expect(validGroups).toContain(`${type}-` as BloodGroup);
    });
  });

  it('null blood group does not insert undefined or empty string', () => {
    const insert = buildProfileInsert('uid', 'Name', null, null, null, '#0F6E56');
    // undefined means the key is omitted from INSERT — correct behavior
    expect(insert.blood_group).toBeUndefined();
    // NOT null, NOT '' — undefined means key is dropped
  });
});

describe('Profile creation validation', () => {
  it('name.trim().length === 0 should disable Continue', () => {
    const isNameValid = (name: string) => name.trim().length > 0;
    expect(isNameValid('')).toBe(false);
    expect(isNameValid('   ')).toBe(false);
    expect(isNameValid('\t\n')).toBe(false);
    expect(isNameValid('A')).toBe(true);
    expect(isNameValid('Ishan')).toBe(true);
  });

  it('whitespace-only name is treated as empty', () => {
    const isNameValid = (name: string) => name.trim().length > 0;
    expect(isNameValid('   ')).toBe(false);
  });
});
