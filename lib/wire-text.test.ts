import {test} from "node:test";
import assert from "node:assert/strict";
import {cleanWireText,wireHtmlToText} from "./wire-text";

test("Global headline, paragraphs and bullet lines survive client cleanup",()=>{
 const text="Başlık\n\n112 milyon sözleşme.\n\n🔸 İşlem hacmi: %53\n🔸 S&P 500: -%4,4\n🔸 VIX: Mart ayından bu yana en yüksek seviye";
 assert.equal(cleanWireText(text+"\n(@WalterBloomberg) https://example.com ***"),text);
 assert.equal(cleanWireText("• Bir\n• İki"),"• Bir\n• İki");
});

test("HTML line breaks and CRLF are preserved as newlines",()=>{
 assert.equal(wireHtmlToText("<b>Başlık</b><br><br>Gövde<br>🔸 Madde"),"Başlık\n\nGövde\n🔸 Madde");
 assert.equal(cleanWireText("Başlık\r\n\r\nGövde"),"Başlık\n\nGövde");
});
