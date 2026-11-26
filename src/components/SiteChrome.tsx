"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { CountryChip } from "@/components/CountryChip";
import {
  ADD_CART_EVENT,
  CART_EVENT,
  addToCart,
  cartTotal,
  normalizeCartLine,
  readCart,
  removeFromCart,
  vatIncluded,
  type AddCartDetail,
} from "@/lib/cart";
import type { CartLine } from "@/types/domain";

const NAV = [
  { href: "/rankings", label: "Rankings", key: "rankings" },
  { href: "/calendar", label: "Events", key: "events" },
  { href: "/athletes", label: "Athletes", key: "athletes" },
  { href: "/records", label: "Records", key: "records" },
  { href: "/shop", label: "Shop", key: "shop" },
];

const BOTTOM = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/rankings", label: "Rankings", icon: "rank" },
  { href: "/calendar", label: "Events", icon: "calendar" },
  { href: "/shop", label: "Shop", icon: "cart" },
  { href: "/account", label: "Me", icon: "user" },
];

export type LiveBarEvent = {
  slug: string;
  shortName: string;
  day?: number;
  ofDays?: number;
  disciplines: string[];
  venue: string;
};

export type SearchAthlete = {
  slug: string;
  name: string;
  country: string;
  hint: string;
};

export type SearchEvent = {
  slug: string;
  shortName: string;
  hint: string;
};

function matchNav(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LiveBar({ event }: { event: LiveBarEvent }) {
  const dayLabel =
    event.day && event.ofDays
      ? ` · Day ${event.day} of ${event.ofDays}`
      : "";
  const disc = event.disciplines[0] ? ` · ${event.disciplines[0]}` : "";
  return (
    <div className="livebar" role="region" aria-label="Live now">
      <div className="container">
        <Link href={`/events/${event.slug}`}>
          <span className="dot-live" aria-hidden="true" />
          <strong>LIVE</strong>
          <span className="ticker">
            {event.shortName}
            {dayLabel}
            {disc} · {event.venue}
          </span>
          <span className="go">
            Watch live <Icon name="arrow" />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function SiteHeader({
  solid = false,
  featuredAthletes = [],
  featuredEvents = [],
}: {
  solid?: boolean;
  featuredAthletes?: SearchAthlete[];
  featuredEvents?: SearchEvent[];
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    setCart(readCart());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setCartOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent).detail as AddCartDetail;
      setCart(addToCart(normalizeCartLine(detail)));
      setCartOpen(true);
    };
    const onChanged = () => setCart(readCart());
    window.addEventListener(ADD_CART_EVENT, onAdd);
    window.addEventListener(CART_EVENT, onChanged);
    window.addEventListener("storage", onChanged);
    return () => {
      window.removeEventListener(ADD_CART_EVENT, onAdd);
      window.removeEventListener(CART_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cart-open", cartOpen);
    document.body.classList.toggle("menu-open", menuOpen);
    document.body.classList.toggle("sheet-open", menuOpen);
    document.body.classList.toggle("palette-open", searchOpen);
    return () => {
      document.body.classList.remove(
        "cart-open",
        "menu-open",
        "sheet-open",
        "palette-open",
      );
    };
  }, [cartOpen, menuOpen, searchOpen]);

  const total = cartTotal(cart);
  const vat = vatIncluded(total);

  return (
    <>
      <header
        className={`site-header${solid || scrolled ? " site-header--solid is-scrolled" : ""}`}
      >
        <div className="container header-in">
          <Link className="brand" href="/" aria-label="Depthboard home">
            <b>DEPTH</b>
            <i />
            <span>BOARD</span>
          </Link>
          <nav className="main-nav" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={matchNav(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="search-btn"
              type="button"
              aria-label="Search athletes, events, countries"
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" />
              <span>Search athletes, events…</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              className="icon-btn hide-mobile"
              type="button"
              aria-label="Notifications"
            >
              <Icon name="bell" />
            </button>
            <button
              className="icon-btn"
              type="button"
              aria-label="Open cart"
              onClick={() => setCartOpen(true)}
            >
              <Icon name="cart" />
              {cart.length > 0 && <span className="count">{cart.length}</span>}
            </button>
            <Link className="btn btn--sm" href="/claim">
              Sign in
            </Link>
            <button
              className="icon-btn menu-toggle"
              type="button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <div
        className="drawer-back"
        onClick={() => setCartOpen(false)}
        aria-hidden={!cartOpen}
      />
      <aside className="drawer" aria-label="Cart" role="dialog" aria-modal={cartOpen}>
        <header>
          <h2 style={{ fontSize: "1.25rem" }}>
            Your cart{" "}
            <span
              className="muted small"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              {cart.length} item{cart.length === 1 ? "" : "s"}
            </span>
          </h2>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
          >
            <Icon name="x" />
          </button>
        </header>
        <div className="drawer-body">
          {cart.length === 0 ? (
            <div className="cart-empty empty">
              <Icon name="cart" />
              <p>Your cart is empty.</p>
              <p className="small muted">
                Browse the shop for Diveye AIDA clips (sample → social → HQ).
                Guests can cart; checkout needs sign-in.
              </p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div className="line-item" data-price={item.price} key={idx}>
                <div
                  className="scene"
                  style={
                    {
                      "--h": item.scene.h,
                      "--x": item.scene.x,
                      "--d": item.scene.d,
                    } as React.CSSProperties
                  }
                >
                  <span className="rope" />
                </div>
                <div>
                  <div className="t">{item.title}</div>
                  <div className="d">{item.description}</div>
                  <button
                    className="rm"
                    type="button"
                    onClick={() => setCart(removeFromCart(idx))}
                  >
                    Remove
                  </button>
                </div>
                <div className="pr">
                  {item.price > 0 ? `€${item.price.toFixed(2)}` : "Free"}
                </div>
              </div>
            ))
          )}
        </div>
        <footer>
          <div className="totals">
            <div className="tr">
              <span>VAT included</span>
              <span>€{vat.toFixed(2)}</span>
            </div>
            <div className="tr big">
              <span>Total</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>
          <Link
            className="btn btn--primary btn--lg btn--block"
            href="/cart"
            onClick={() => setCartOpen(false)}
          >
            {cart.length ? `Go to checkout · €${total.toFixed(2)}` : "Open cart"}
          </Link>
          <div className="pay-methods">
            <span className="pay">Simulated pay</span>
            <span className="pay">Stripe later</span>
            <span className="pay">P24 later</span>
          </div>
        </footer>
      </aside>

      <div className="sheet-back" onClick={() => setMenuOpen(false)} />
      <div className="menu-panel" aria-label="Menu">
        <div className="row row--between" style={{ marginBottom: 12 }}>
          <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
            <b>DEPTH</b>
            <i />
            <span>BOARD</span>
          </Link>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="x" />
          </button>
        </div>
        {[
          ["/rankings", "rank", "Rankings"],
          ["/calendar", "calendar", "Events & calendar"],
          ["/athletes", "user", "Athletes"],
          ["/records", "trophy", "Records"],
          ["/archive", "film", "Archive / VOD"],
          ["/shop", "cart", "Shop"],
          ["/claim", "shield", "Claim your profile"],
          ["/login", "user", "Sign in"],
          ["/account", "users", "Account"],
        ].map(([href, icon, label]) => (
          <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
            <Icon name={icon} /> {label}
          </Link>
        ))}
      </div>

      <div
        className="palette-back"
        role="dialog"
        aria-modal={searchOpen}
        aria-label="Search"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSearchOpen(false);
        }}
      >
        <div className="palette">
          <div className="in">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Search athletes, events, countries, records"
              aria-label="Search"
              autoComplete="off"
              autoFocus={searchOpen}
            />
            <button
              className="btn btn--sm btn--ghost"
              type="button"
              onClick={() => setSearchOpen(false)}
            >
              Esc
            </button>
          </div>
          {featuredEvents.length > 0 && (
            <>
              <div className="grp">Events</div>
              {featuredEvents.map((ev) => (
                <Link
                  key={ev.slug}
                  className="it"
                  href={`/events/${ev.slug}`}
                  onClick={() => setSearchOpen(false)}
                >
                  <Icon name="calendar" /> {ev.shortName}{" "}
                  <small>{ev.hint}</small>
                </Link>
              ))}
            </>
          )}
          {featuredAthletes.length > 0 && (
            <>
              <div className="grp">Top athletes</div>
              {featuredAthletes.map((a) => (
                <Link
                  key={a.slug}
                  className="it"
                  href={`/athletes/${a.slug}`}
                  onClick={() => setSearchOpen(false)}
                >
                  <CountryChip code={a.country} /> {a.name}{" "}
                  <small>{a.hint}</small>
                </Link>
              ))}
            </>
          )}
          <div className="grp">Explore</div>
          <Link className="it" href="/rankings" onClick={() => setSearchOpen(false)}>
            <Icon name="rank" /> Rankings
          </Link>
          <Link className="it" href="/archive" onClick={() => setSearchOpen(false)}>
            <Icon name="film" /> Archive &amp; VOD search
          </Link>
          <Link className="it" href="/records" onClick={() => setSearchOpen(false)}>
            <Icon name="trophy" /> World records <small>All disciplines</small>
          </Link>
          <div className="hint-end">
            Diacritics are ignored: type “wisniewska” to find Wiśniewska.
          </div>
        </div>
      </div>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="foot-grid">
          <div>
            <Link className="brand" href="/">
              <b>DEPTH</b>
              <i />
              <span>BOARD</span>
            </Link>
            <p className="muted small" style={{ marginTop: 14, maxWidth: 340 }}>
              Freediving results, records and footage, in one place. Official
              results from AIDA and CMAS, with every dive on video.
            </p>
            <p className="endorse">
              A platform by the team behind <b>DIVEYE</b> underwater broadcasts
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li>
                <Link href="/rankings">Rankings</Link>
              </li>
              <li>
                <Link href="/calendar">Events &amp; calendar</Link>
              </li>
              <li>
                <Link href="/records">Records</Link>
              </li>
              <li>
                <Link href="/athletes">Athletes</Link>
              </li>
              <li>
                <Link href="/archive">Archive / VOD</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Footage</h4>
            <ul>
              <li>
                <Link href="/shop">Shop</Link>
              </li>
              <li>
                <Link href="/shop#media-pack">Media packs</Link>
              </li>
              <li>
                <Link href="/account">My library</Link>
              </li>
              <li>
                <Link href="/cart">Cart</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>About</h4>
            <ul>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/cookies">Cookies</Link>
              </li>
              <li>
                <Link href="/claim">Claim your profile</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-end">
          <span>
            © 2026 Depthboard. Working name. AIDA and CMAS are trademarks of
            their respective owners.
          </span>
          <span>Results via AIDA/CMAS ingest · footage archive coming next</span>
        </div>
      </div>
    </footer>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {BOTTOM.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={matchNav(pathname, item.href) ? "page" : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("db-cookie")) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="cookie-banner"
    >
      <p className="small">
        Essential cookies only (cart stub, preferences).{" "}
        <Link href="/cookies">Policy</Link>
      </p>
      <div className="row" style={{ gap: 8, flex: "none" }}>
        <button
          className="btn btn--primary btn--sm"
          type="button"
          onClick={() => {
            try {
              localStorage.setItem("db-cookie", "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Accept
        </button>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss cookie notice"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
