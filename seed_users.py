"""
Seed the database with fake users, vault entries, and a skewed distribution
of won passwords.

  python seed_users.py            # create ~50 fake users
  python seed_users.py --count 80
  python seed_users.py --clear    # delete every seeded user again

All seeded users have emails ending in @seed.example.com (that's how --clear
finds them) and share the login password below.
"""
import argparse
import json
import random
import secrets
import string
from datetime import datetime, timedelta

from database import SessionLocal, init_db
from models import User, UserPassword, PasswordBank
from utils import hash_password, encrypt_password

SEED_DOMAIN = "@seed.example.com"
SEED_LOGIN_PASSWORD = "testpass123"   # log in as any fake user with this

FIRST = ["james", "maria", "wei", "aisha", "liam", "sofia", "carlos", "priya", "noah",
         "emma", "omar", "yuki", "lucas", "olga", "ethan", "fatima", "mateo", "chloe",
         "dmitri", "hannah", "raj", "isabel", "jack", "nina", "tyler", "amara", "felix",
         "grace", "ivan", "leila", "sam", "zoe", "marcus", "elena", "kenji", "molly",
         "andre", "tessa", "hugo", "bella", "diego", "ruth", "owen", "ines", "cal", "dana"]

LAST = ["smith", "garcia", "chen", "patel", "kim", "nguyen", "brown", "muller", "silva",
        "jones", "ivanov", "khan", "rossi", "tanaka", "wilson", "lopez", "novak", "cohen",
        "murphy", "santos", "olsen", "reyes", "walker", "dubois", "lee", "ahmed", "moore",
        "fischer", "young", "costa", "hall", "kowalski", "rivera", "baker", "sato"]

HOBBY = ["chess", "rook", "pawn", "gambit", "endgame", "blitz", "fork", "castle", "tempo",
         "coffee", "hiker", "pixel", "guitar", "cyclist", "gamer", "coder", "reader",
         "night", "storm", "pine", "river", "ghost", "pilot", "fox", "wolf", "bear",
         "raven", "moon", "ember", "salt", "static", "sparrow", "atlas", "comet"]

QUIRKY = ["definitely", "not", "just", "mr", "ms", "big", "tiny", "sir", "captain",
          "lazy", "sleepy", "dr", "the", "real", "old", "mad"]

SERVICES = [
    # Streaming & media
    "Netflix", "Spotify", "Hulu", "Disney+", "HBO Max", "Prime Video", "YouTube Premium",
    "Apple TV+", "Paramount+", "Peacock", "Crunchyroll", "Twitch", "Audible", "Tidal",
    "Deezer", "SoundCloud", "Pandora", "Plex", "Kindle Unlimited", "Vimeo",

    # Gaming
    "Steam", "Epic Games", "PlayStation", "Xbox Live", "Nintendo", "Battle.net",
    "Ubisoft Connect", "GOG", "itch.io", "Roblox", "Minecraft", "Riot Games",
    "Chess.com", "GeForce Now", "Twitch Prime",

    # Social & communication
    "Discord", "Reddit", "Pinterest", "LinkedIn", "Tumblr", "Snapchat", "Instagram",
    "Facebook", "X", "Bluesky", "Telegram", "Slack", "Zoom", "Skype",
    "WhatsApp", 

    # Productivity & cloud
    "GitHub", "GitLab", "Dropbox", "Google Drive", "OneDrive", "iCloud", "Canva", "Adobe", "Microsoft 365",

    # Shopping & delivery
    "Amazon", "eBay", "Etsy", "Walmart", "Target", "Best Buy", "AliExpress", "Shopify",
    "DoorDash", "Uber Eats", "Grubhub", "Instacart", "Uber", "Lyft", "Airbnb",
    "Depop",

    # Learning & fitness
    "Duolingo", "LeetCode", "Strava", "MyFitnessPal",

    # Finance & misc
    "PayPal", "Venmo", "Cash App", "Robinhood", "Coinbase"
]

POPULAR = ["Netflix", "Spotify", "Steam", "Discord", "Amazon", "GitHub", "Reddit", "Twitch"]

random.seed()  # set to a fixed number (e.g. random.seed(42)) for repeatable runs


def fake_password(length=16):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _year():
    return random.choice([random.randint(1975, 2008), random.randint(70, 99), random.randint(0, 9)])


def _pick_style():
    styles = [
        (22, lambda: f"{random.choice(FIRST)}{random.choice(LAST)}"),                       # jameswilson
        (14, lambda: f"{random.choice(FIRST)}_{random.choice(LAST)}"),                      # maria_garcia
        (10, lambda: f"{random.choice(FIRST)}.{random.choice(LAST)}"),                      # wei.chen
        (12, lambda: f"{random.choice(FIRST)}{_year()}"),                                   # liam94
        (8,  lambda: f"{random.choice(FIRST)[0]}{random.choice(LAST)}"),                    # jsmith
        (7,  lambda: f"{random.choice(FIRST).capitalize()}{random.choice(LAST).capitalize()}"),  # MariaGarcia
        (9,  lambda: f"{random.choice(HOBBY)}{random.choice(HOBBY)}"),                      # ravenblitz
        (8,  lambda: f"{random.choice(HOBBY)}_{random.choice(FIRST)}"),                     # fox_priya
        (6,  lambda: f"{random.choice(HOBBY)}{random.randint(1, 999)}"),                    # comet482
        (5,  lambda: f"{random.choice(QUIRKY)}{random.choice(HOBBY)}"),                     # sleepypawn
        (4,  lambda: f"xX{random.choice(HOBBY).capitalize()}Xx"),                           # xXWolfXx
        (4,  lambda: f"{random.choice(FIRST)}{random.choice(['_', ''])}{random.choice(HOBBY)}"),  # zoe_chess
        (3,  lambda: random.choice(HOBBY)),                                                 # atlas (short, "old account")
        (3,  lambda: f"{random.choice(FIRST)}{random.choice(LAST)}{random.choice(['', '_', '99', '1'])}"),
    ]
    weights = [w for w, _ in styles]
    return random.choices([f for _, f in styles], weights=weights)[0]


def _decorate(name):
    """Small human quirks: random capitalization, trailing underscores/digits."""
    roll = random.random()
    if roll < 0.10:
        name = name.capitalize()
    elif roll < 0.14:
        name = name.upper()
    if random.random() < 0.05:
        name += "_"
    elif random.random() < 0.05:
        name = "_" + name
    return name


def make_usernames(n):
    names = set()
    while len(names) < n:
        name = _decorate(_pick_style()())
        if 3 <= len(name) <= 30:
            names.add(name)
    return list(names)


def target_wins():
    """Skewed: many players with none, most with a few, a handful of top dogs."""
    if random.random() < 0.25:
        return 0
    return min(int(random.paretovariate(1.1)), 15)


def seed(count):
    init_db()
    db = SessionLocal()
    try:
        shared_hash = hash_password(SEED_LOGIN_PASSWORD)  # hash once, reuse
        now = datetime.utcnow()

        # 1. Users and their vault entries (offerings)
        users = []
        for name in make_usernames(count):
            if db.query(User).filter(User.username == name).first():
                continue
            user = User(
                username=name,
                email=f"{name.lower()}{SEED_DOMAIN}",
                password_hash=shared_hash,
                created_at=now - timedelta(days=random.randint(1, 90),
                                           hours=random.randint(0, 23)),
            )
            db.add(user)
            db.flush()  # assigns user.id

	picks = set(random.sample(POPULAR, random.randint(1, 2)))
	picks.update(random.sample(SERVICES, random.randint(1, 3)))
	for service in picks:
		first = random.choice(FIRST)
                account = random.choice([
                    f"{name.lower()}@gmail.com",
                    f"{first}{random.randint(1, 99)}@outlook.com",
                    f"{first}.{random.choice(LAST)}@yahoo.com",
                    f"{random.choice(HOBBY)}{random.randint(1, 999)}@proton.me",
                    name.lower(),
                    f"{first}{random.choice(LAST)}@icloud.com",
                ])
                secret = json.dumps({"username": account, "password": fake_password()})
                db.add(UserPassword(
                    user_id=user.id,
                    service_name=service,
                    secret_value=encrypt_password(secret),
                ))
            users.append(user)
        db.commit()
        print(f"Created {len(users)} users")

        # 2. Passwords "won": copy other players' encrypted offerings into the
        #    winner's bank, exactly like complete_challenge() does.
        offerings = db.query(UserPassword).filter(
            UserPassword.user_id.in_([u.id for u in users])
        ).all()

        total = 0
        for winner in users:
            wins = target_wins()
            taken = set()  # (user_id, service_name) is unique in the bank
            candidates = [o for o in offerings if o.user_id != winner.id]
            random.shuffle(candidates)
            for offering in candidates:
                if wins == 0:
                    break
                if offering.service_name in taken:
                    continue
                taken.add(offering.service_name)
                db.add(PasswordBank(
                    user_id=winner.id,
                    service_name=offering.service_name,
                    secret_value=offering.secret_value,
                    collected_from=offering.user_id,
                    collected_at=now - timedelta(days=random.randint(0, 30),
                                                 hours=random.randint(0, 23)),
                ))
                wins -= 1
                total += 1
        db.commit()
        print(f"Created {total} won passwords")
        print(f"Log in as any of them with password: {SEED_LOGIN_PASSWORD}")
    finally:
        db.close()


def clear():
    db = SessionLocal()
    try:
        fakes = db.query(User).filter(User.email.like(f"%{SEED_DOMAIN}")).all()
        for user in fakes:
            db.delete(user)   # cascades to their vault, bank, challenges
        db.commit()
        print(f"Deleted {len(fakes)} seeded users")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    clear() if args.clear else seed(args.count)